import { useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import type { Alignment } from '../utils/graphEditing';

const alignments: Array<[Alignment, string]> = [
  ['left', '왼쪽 맞춤'],
  ['center', '가로 가운데'],
  ['right', '오른쪽 맞춤'],
  ['top', '위쪽 맞춤'],
  ['middle', '세로 가운데'],
  ['bottom', '아래쪽 맞춤'],
  ['horizontal', '가로 간격 균등'],
  ['vertical', '세로 간격 균등'],
];
export function SelectionInspector({ count, edgeCount }: { count: number; edgeCount: number }) {
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [gap, setGap] = useState(48);
  return (
    <div className="selection-inspector">
      <h3>
        노드 {count}개 · 연결선 {edgeCount}개 선택
      </h3>
      <p>공통 속성은 선택한 노드에 적용됩니다. 정렬 시 함께 선택한 그룹과 자식은 그룹을 기준으로 이동합니다.</p>
      {count > 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            useGraphStore.getState().updateSelectedNodes({
              ...(subtitle !== null ? { subtitle } : {}),
              ...(note !== null ? { note } : {}),
              ...(accent !== null ? { accent } : {}),
            });
          }}
        >
          <label className="field-label" htmlFor="batch-subtitle">
            공통 부제목
          </label>
          <input
            className="field-input"
            id="batch-subtitle"
            placeholder="변경하지 않음"
            value={subtitle ?? ''}
            onChange={(event) => setSubtitle(event.target.value)}
          />
          <label className="field-label" htmlFor="batch-note">
            공통 메모
          </label>
          <textarea
            className="field-textarea"
            id="batch-note"
            placeholder="변경하지 않음"
            value={note ?? ''}
            onChange={(event) => setNote(event.target.value)}
          />
          <label className="field-label" htmlFor="batch-accent">
            공통 강조색
          </label>
          <input id="batch-accent" type="color" value={accent ?? '#2563eb'} onChange={(event) => setAccent(event.target.value)} />
          <button className="secondary-button" type="submit">
            공통 속성 적용
          </button>
        </form>
      )}
      {count > 1 && (
        <>
          <h4>정렬과 간격</h4>
          <div className="alignment-grid">
            {alignments.map(([value, label]) => (
              <button
                className="secondary-button"
                key={value}
                disabled={(value === 'horizontal' || value === 'vertical') && count < 3}
                onClick={() => useGraphStore.getState().alignSelection(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="selection-gap">
            노드 사이 간격 (px)
          </label>
          <input
            id="selection-gap"
            className="field-input"
            type="number"
            min={0}
            max={2000}
            value={Number.isFinite(gap) ? gap : ''}
            onChange={(event) => setGap(event.target.valueAsNumber)}
          />
          <div className="alignment-grid">
            <button className="secondary-button" onClick={() => useGraphStore.getState().spaceSelection('horizontal', gap)}>
              가로 간격 적용
            </button>
            <button className="secondary-button" onClick={() => useGraphStore.getState().spaceSelection('vertical', gap)}>
              세로 간격 적용
            </button>
          </div>
        </>
      )}
      <div className="selection-actions">
        <button className="secondary-button" disabled={!count} onClick={() => useGraphStore.getState().duplicateSelection()}>
          선택 복제
        </button>
        <button className="secondary-button" disabled={!count} onClick={() => useGraphStore.getState().groupSelection()}>
          선택을 그룹으로
        </button>
        <button className="danger-button" onClick={() => useGraphStore.getState().deleteSelection()}>
          선택 삭제
        </button>
      </div>
    </div>
  );
}
