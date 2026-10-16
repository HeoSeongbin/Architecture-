import { useEffect, useRef, useState } from 'react';
import { DEFAULT_EXPORT, exportDiagram, type ExportOptions } from '../utils/exportDiagram';
import type { EditorTheme } from '../hooks/useEditorTheme';

export function ExportDialog({ theme, close, onBusy }: { theme: EditorTheme; close: () => void; onBusy: (busy: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const objectUrl = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [options, setOptions] = useState(DEFAULT_EXPORT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    url: string;
    filename: string;
    width: number;
    height: number;
    format: ExportOptions['format'];
    size: number;
  } | null>(null);
  const changeOptions = (next: ExportOptions) => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setResult(null);
    setError('');
    setOptions(next);
  };
  useEffect(() => {
    mounted.current = true;
    const focused = document.activeElement;
    if (dialog.current?.showModal) dialog.current.showModal();
    else if (dialog.current) dialog.current.open = true;
    return () => {
      mounted.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      onBusy(false);
      if (focused instanceof HTMLElement) focused.focus();
    };
  }, [onBusy]);
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setResult(null);
    try {
      const root = document.querySelector<HTMLElement>('#diagram-workspace .react-flow');
      if (!root) throw new Error('캔버스를 찾지 못했습니다.');
      const output = await exportDiagram(root, options, theme);
      if (!mounted.current) return;
      const url = URL.createObjectURL(output.blob);
      objectUrl.current = url;
      setResult({
        url,
        filename: `architecture-${options.scope}-${new Date().toISOString().slice(0, 10)}.${options.format}`,
        format: options.format,
        width: output.pixelWidth,
        height: output.pixelHeight,
        size: output.blob.size,
      });
    } catch (reason) {
      if (mounted.current)
        setError(reason instanceof Error ? reason.message : '파일을 만들지 못했습니다. 배율을 줄이거나 JSON으로 백업하세요.');
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };
  return (
    <dialog
      ref={dialog}
      className="export-dialog"
      aria-labelledby="export-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="export-title">다이어그램 내보내기</h2>
      <form onSubmit={(event) => void generate(event)}>
        <fieldset disabled={busy} className="export-fields">
          <label>
            형식
            <select
              aria-label="출력 형식"
              value={options.format}
              onChange={(event) =>
                changeOptions({
                  ...options,
                  format: event.target.value as ExportOptions['format'],
                  scale: event.target.value === 'svg' ? 1 : options.scale,
                })
              }
            >
              <option value="png">PNG 이미지</option>
              <option value="svg">SVG 이미지</option>
              <option value="pdf">PDF 문서</option>
            </select>
          </label>
          <label>
            범위
            <select
              aria-label="출력 범위"
              value={options.scope}
              onChange={(event) => changeOptions({ ...options, scope: event.target.value as ExportOptions['scope'] })}
            >
              <option value="all">전체 다이어그램</option>
              <option value="viewport">현재 화면</option>
            </select>
          </label>
          <label>
            배율
            <select
              aria-label="출력 배율"
              disabled={options.format === 'svg'}
              value={options.scale}
              onChange={(event) => changeOptions({ ...options, scale: Number(event.target.value) })}
            >
              {[1, 2, 3, 4].map((scale) => (
                <option value={scale} key={scale}>
                  {scale}×
                </option>
              ))}
            </select>
          </label>
          <label>
            배경
            <select
              aria-label="출력 배경"
              value={options.background}
              onChange={(event) => changeOptions({ ...options, background: event.target.value as ExportOptions['background'] })}
            >
              <option value="theme">현재 테마</option>
              <option value="white">흰색</option>
              <option value="dark">어두운색</option>
              <option value="transparent">투명 (PDF는 흰색)</option>
            </select>
          </label>
        </fieldset>
        <p className="export-hint">
          최대 한 변 8,192px · 16메가픽셀. 전체 영역은 노드·연결선·이동한 라벨과 여백을 포함합니다. 현재 화면은 보이는 범위만 저장합니다.
        </p>
        {options.format === 'svg' && (
          <p className="export-hint">
            SVG는 확대 가능한 브라우저용 이미지입니다. HTML 텍스트를 포함하여 일부 문서 편집기에서는 표시가 다를 수 있습니다.
          </p>
        )}
        {options.format === 'pdf' && <p className="export-hint">PDF는 단일 페이지 이미지입니다. 텍스트 선택·검색은 지원하지 않습니다.</p>}
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={close}>
            닫기
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? '파일 생성 중…' : '파일 만들기'}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="feedback-error">
          {error} 현재 작업은 유지됩니다.
        </p>
      )}
      {result && (
        <section className="export-result" aria-label="출력 결과">
          <p role="status">
            {result.width.toLocaleString()} × {result.height.toLocaleString()}px · {(result.size / 1024).toFixed(1)} KiB 파일 생성 완료.
            아래 링크로 저장하세요.
          </p>
          <a className="primary-button" href={result.url} download={result.filename}>
            파일 다운로드
          </a>
          {result.format !== 'pdf' && <img className="export-preview" src={result.url} alt="내보낸 다이어그램 미리보기" />}
        </section>
      )}
    </dialog>
  );
}
