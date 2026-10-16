import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import App from '../App';
import '../styles.css';
import { useGraphStore } from '../store/useGraphStore';
import { createBenchmarkGraph, BENCHMARK_SIZES, summarize, type BenchmarkScenario } from './fixtures';
import { encodeStateToUrl, decodeStateFromUrl } from '../utils/urlUtils';
import { parseImportedGraph, toExportableGraph } from '../utils/jsonUtils';
import { exportDiagram, DEFAULT_EXPORT } from '../utils/exportDiagram';
import { auditEditor } from './accessibilityAudit';

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const rendered = async () => {
  await frame();
  await frame();
};
const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
export function BenchmarkPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(
    '테스트 전용 페이지: 실행하면 이 탭의 그래프를 측정 데이터로 교체합니다. 일반 앱 빌드에는 포함되지 않습니다.',
  );
  const [report, setReport] = useState<unknown>(null);
  const stop = useRef(false);
  const [exportCount, setExportCount] = useState(100);
  const [exportScenario, setExportScenario] = useState<BenchmarkScenario>('chain');
  const [minimized, setMinimized] = useState(false);
  const repeatExport = async () => {
    setRunning(true);
    const samples: unknown[] = [];
    try {
      useGraphStore.getState().setGraph(createBenchmarkGraph(exportCount, exportScenario));
      await rendered();
      for (let index = 0; index < 3; index++) {
        setProgress(`PNG 반복 ${exportScenario} ${exportCount}: ${index + 1}/3`);
        const start = performance.now();
        const output = await exportDiagram(
          document.querySelector<HTMLElement>('#diagram-workspace .react-flow')!,
          { ...DEFAULT_EXPORT, scale: 1 },
          document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        );
        samples.push({
          ms: Number((performance.now() - start).toFixed(2)),
          width: output.pixelWidth,
          height: output.pixelHeight,
          bytes: output.blob.size,
          heap: heap(),
        });
        await rendered();
      }
      setReport({
        timestamp: new Date().toISOString(),
        kind: 'targeted-png-repeat',
        count: exportCount,
        scenario: exportScenario,
        samples,
      });
      setProgress('PNG 반복 측정 완료');
    } catch (error) {
      setProgress(String(error));
    } finally {
      setRunning(false);
    }
  };
  const run = async () => {
    stop.current = false;
    setRunning(true);
    setReport(null);
    const longTasks: number[] = [];
    const observer =
      typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
        ? new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration)))
        : null;
    observer?.observe({ type: 'longtask', buffered: false });
    const rows: unknown[] = [];
    try {
      const calibration: number[] = [];
      let previous = await frame();
      for (let i = 0; i < 10; i++) {
        const now = await frame();
        calibration.push(now - previous);
        previous = now;
      }
      for (const scenario of ['chain', 'dense'] as BenchmarkScenario[])
        for (const count of BENCHMARK_SIZES) {
          if (stop.current) throw new Error('사용자가 측정을 중단했습니다.');
          const graph = createBenchmarkGraph(count, scenario);
          const memory: Record<string, number | null> = { before: heap() };
          setProgress(`${scenario} ${count}개: 로드/선택/드래그/입출력/정렬/PNG 측정 중`);
          const loadStart = performance.now();
          useGraphStore.getState().setGraph(graph);
          await rendered();
          const loadMs = performance.now() - loadStart;
          memory.loaded = heap();
          const selection: number[] = [];
          for (let i = 0; i < 10; i++) {
            const start = performance.now();
            useGraphStore.getState().onNodesChange([{ type: 'select', id: 'bench-0', selected: i % 2 === 0 }]);
            await rendered();
            selection.push(performance.now() - start);
          }
          const drag: number[] = [];
          previous = await frame();
          for (let i = 0; i < 30; i++) {
            useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: i * 2, y: i }, dragging: true }]);
            const now = await frame();
            drag.push(now - previous);
            previous = now;
          }
          const commitStart = performance.now();
          useGraphStore.getState().onNodesChange([{ type: 'position', id: 'bench-0', position: { x: 60, y: 30 }, dragging: false }]);
          await rendered();
          const dragCommitMs = performance.now() - commitStart;
          memory.dragged = heap();
          const timings: Record<string, ReturnType<typeof summarize>> = {};
          const sync = (name: string, action: () => void) => {
            action();
            const values: number[] = [];
            for (let i = 0; i < 10; i++) {
              const start = performance.now();
              action();
              values.push(performance.now() - start);
            }
            timings[name] = summarize(values);
          };
          const json = JSON.stringify(toExportableGraph(graph));
          const encoded = encodeStateToUrl(graph);
          sync('encode', () => {
            encodeStateToUrl(graph);
          });
          sync('decode', () => {
            if (!decodeStateFromUrl(encoded).ok) throw new Error('URL roundtrip failed');
          });
          sync('jsonExport', () => {
            JSON.stringify(toExportableGraph(graph));
          });
          sync('jsonImport', () => {
            parseImportedGraph(JSON.parse(json));
          });
          const layout: number[] = [];
          for (let i = 0; i < 2; i++) {
            useGraphStore.getState().setGraph(graph);
            await rendered();
            const start = performance.now();
            const status = await useGraphStore.getState().autoLayout();
            await rendered();
            if (status !== 'applied') throw new Error(`Unexpected layout: ${String(status)}`);
            layout.push(performance.now() - start);
          }
          memory.laidOut = heap();
          useGraphStore.getState().setGraph(graph);
          await rendered();
          const root = document.querySelector<HTMLElement>('#diagram-workspace .react-flow')!;
          const exports: unknown[] = [];
          for (const scope of ['viewport', 'all'] as const) {
            if (stop.current) throw new Error('사용자가 측정을 중단했습니다.');
            setProgress(`${scenario} ${count}개: PNG ${scope} 1× 생성 중`);
            const start = performance.now();
            try {
              const output = await exportDiagram(
                root,
                { ...DEFAULT_EXPORT, scale: 1, scope },
                document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
              );
              exports.push({
                scope,
                ms: Number((performance.now() - start).toFixed(2)),
                width: output.pixelWidth,
                height: output.pixelHeight,
                bytes: output.blob.size,
              });
            } catch (error) {
              exports.push({ scope, ms: Number((performance.now() - start).toFixed(2)), error: String(error) });
            }
            memory[`png-${scope}`] = heap();
            await rendered();
          }
          rows.push({
            count,
            edges: graph.edges.length,
            scenario,
            loadMs: Number(loadMs.toFixed(2)),
            selection: summarize(selection),
            dragFrames: summarize(drag),
            dragCommitMs: Number(dragCommitMs.toFixed(2)),
            timings,
            layout: summarize(layout),
            exports,
            memory,
          });
          setReport({ partial: true, rows });
          await rendered();
        }
      await rendered();
      setReport({
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        visibility: document.visibilityState,
        frameCalibration: summarize(calibration),
        longTasks: {
          count: longTasks.length,
          totalMs: Number(longTasks.reduce((sum, value) => sum + value, 0).toFixed(2)),
          maxMs: Number(Math.max(0, ...longTasks).toFixed(2)),
        },
        note: 'Production isolated harness. Selection/load/layout completion uses two rAF, drag uses 30 store-driven animation frames (not physical pointer). PNG timings include clone/styles/rasterization. memory samples are approximate JS heap, not native canvas or GC-normalized peak. First layout includes cold engine load.',
        rows,
      });
      setProgress('측정 완료');
    } catch (error) {
      setProgress(String(error));
      setReport({ partial: true, rows, error: String(error) });
    } finally {
      observer?.disconnect();
      setRunning(false);
    }
  };
  return (
    <aside
      aria-label="성능 측정 도구"
      style={{
        position: 'fixed',
        right: 8,
        top: 8,
        zIndex: 80,
        maxWidth: 'min(600px, 90vw)',
        maxHeight: '35vh',
        overflow: 'auto',
        background: '#fff',
        color: '#111',
        border: '2px solid #0369a1',
        padding: 12,
        fontSize: 12,
      }}
    >
      <button onClick={() => setMinimized((value) => !value)}>{minimized ? '측정 패널 펼치기' : '측정 패널 접기'}</button>
      <div hidden={minimized}>
        <h2>Phase 6 — 분리된 production 벤치마크</h2>
        <p role="status">{progress}</p>
        <button disabled={running} onClick={() => void run()}>
          전체 측정 시작
        </button>{' '}
        <button
          disabled={!running}
          onClick={() => {
            stop.current = true;
          }}
        >
          중단
        </button>
        <p>10/50/100/300 nodes · chain/dense · PNG 1× · 최대 16MP</p>
        <label>
          재측정 노드
          <select
            aria-label="재측정 노드"
            disabled={running}
            value={exportCount}
            onChange={(event) => setExportCount(Number(event.target.value))}
          >
            {BENCHMARK_SIZES.map((count) => (
              <option key={count}>{count}</option>
            ))}
          </select>
        </label>
        <label>
          재측정 연결
          <select
            aria-label="재측정 연결"
            disabled={running}
            value={exportScenario}
            onChange={(event) => setExportScenario(event.target.value as BenchmarkScenario)}
          >
            <option value="chain">chain</option>
            <option value="dense">dense</option>
          </select>
        </label>
        <button disabled={running} onClick={() => void repeatExport()}>
          PNG 3회 재측정
        </button>
        <button
          disabled={running}
          onClick={() => {
            setReport(auditEditor(document.querySelector<HTMLElement>('.editor-shell')!));
            setProgress('접근성 점검 완료');
          }}
        >
          접근성 점검
        </button>
        {report !== null && (
          <pre aria-label="벤치마크 JSON" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </aside>
  );
}
createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <BenchmarkPanel />
  </>,
);
