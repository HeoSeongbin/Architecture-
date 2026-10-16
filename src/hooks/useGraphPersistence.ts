import { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { toExportableGraph } from '../utils/jsonUtils';
import { decodeStateFromUrl, encodeStateToUrl } from '../utils/urlUtils';
import { URL_MAX_LENGTH, URL_WARNING_LENGTH } from '../utils/graphValidation';
import type { GraphState } from '../types/graph';
import { hasPersistentGraphChange } from '../utils/persistenceChanges';

const signature = (graph: GraphState) => JSON.stringify(toExportableGraph(graph));
export function useGraphPersistence() {
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState('');
  const [urlSize, setUrlSize] = useState(0);
  const [external, setExternal] = useState<GraphState | null>(null);
  const initialized = useRef(false);
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const decoded = decodeStateFromUrl(window.location.hash);
      if (decoded.ok) {
        useGraphStore.getState().setGraph(decoded.state);
        if (window.location.href.length > URL_MAX_LENGTH)
          setMessage('URL이 64,000자를 초과했습니다. 수정 후 자동 URL 저장이 제한될 수 있으니 JSON으로 백업하세요.');
        else if (window.location.href.length > URL_WARNING_LENGTH)
          setMessage('URL이 8,000자를 넘었습니다. 공유 환경에 따라 잘릴 수 있으니 JSON으로 백업하세요.');
      } else
        setMessage(
          `공유 URL을 복원하지 못했습니다. ${decoded.error instanceof Error ? decoded.error.message : '손상된 데이터입니다.'} JSON 백업을 가져오세요.`,
        );
      setHydrated(true);
      setUrlSize(window.location.href.length);
    }
    let lastSignature = signature(useGraphStore.getState());
    let timer: number | undefined;
    let currentUrl = window.location.pathname + window.location.search + window.location.hash;
    const write = () => {
      window.clearTimeout(timer);
      const graph = useGraphStore.getState();
      try {
        const encoded = encodeStateToUrl(graph);
        const url = `${window.location.pathname}${window.location.search}${encoded ? `#${encoded}` : ''}`;
        setUrlSize(window.location.origin.length + url.length);
        if (window.location.origin.length + url.length > URL_MAX_LENGTH) {
          setMessage('URL이 64,000자를 초과해 자동 저장을 중단했습니다. 현재 작업을 JSON으로 내보내세요.');
          return;
        }
        window.history.replaceState(null, '', url);
        currentUrl = url;
        lastSignature = signature(graph);
        setMessage(
          window.location.origin.length + url.length > URL_WARNING_LENGTH
            ? 'URL이 8,000자를 넘었습니다. 공유 환경에 따라 잘릴 수 있으니 JSON으로 백업하세요.'
            : '',
        );
      } catch (error) {
        setMessage(`URL 저장 실패: ${error instanceof Error ? error.message : 'JSON으로 백업하세요.'}`);
      }
    };
    flushRef.current = write;
    const unsubscribe = useGraphStore.subscribe((state, previous) => {
      if (state.nodes === previous.nodes && state.edges === previous.edges) return;
      const transforming = state.nodes.some((node) => node.dragging || node.resizing);
      const finished = previous.nodes.some((node) => node.dragging || node.resizing) && !transforming;
      if (!transforming && !finished && !hasPersistentGraphChange(state, previous)) return;
      window.clearTimeout(timer);
      if (transforming) return;
      timer = window.setTimeout(() => {
        if (signature(useGraphStore.getState()) !== lastSignature) write();
      }, 400);
    });
    const onHashChange = () => {
      window.clearTimeout(timer);
      const decoded = decodeStateFromUrl(window.location.hash);
      window.history.replaceState(null, '', currentUrl);
      // A navigation must not cancel an unsaved debounce indefinitely.
      if (signature(useGraphStore.getState()) !== lastSignature) write();
      if (!decoded.ok) {
        setMessage(
          `공유 URL을 복원하지 못했습니다. ${decoded.error instanceof Error ? decoded.error.message : '손상된 데이터입니다.'} 현재 작업은 유지됩니다.`,
        );
        return;
      }
      if (signature(decoded.state) === signature(useGraphStore.getState())) return;
      const current = useGraphStore.getState();
      if (current.nodes.length || current.edges.length) setExternal(decoded.state);
      else {
        current.replaceGraph(decoded.state);
        write();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (signature(useGraphStore.getState()) !== lastSignature) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
  return { hydrated, message, urlSize, external, clearExternal: () => setExternal(null), flush: () => flushRef.current() };
}
