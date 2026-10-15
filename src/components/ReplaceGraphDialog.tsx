import { useEffect, useRef } from 'react';
export function ReplaceGraphDialog({ title, apply, cancel }: { title: string; apply: () => void; cancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const focused = document.activeElement;
    if (dialog.current?.showModal) dialog.current.showModal();
    else if (dialog.current) dialog.current.open = true;
    return () => {
      if (focused instanceof HTMLElement) focused.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="replace-title"
      className="replace-dialog"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id="replace-title">{title}</h2>
      <p>현재 다이어그램을 교체합니다. 필요한 경우 먼저 JSON으로 백업하세요. 적용 후 실행 취소로 복원할 수 있습니다.</p>
      <div className="button-row">
        <button autoFocus className="secondary-button" onClick={cancel}>
          취소
        </button>
        <button className="primary-button" onClick={apply}>
          교체하기
        </button>
      </div>
    </dialog>
  );
}
