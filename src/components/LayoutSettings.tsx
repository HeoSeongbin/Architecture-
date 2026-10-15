import type { LayoutOptions } from '../utils/layoutGraph';
export function LayoutSettings({
  value,
  change,
  apply,
  busy,
}: {
  value: LayoutOptions;
  change: (value: LayoutOptions) => void;
  apply: () => void;
  busy: boolean;
}) {
  return (
    <details className="tool-menu" name="editor-tools">
      <summary>정렬 설정</summary>
      <div className="tool-menu-content layout-settings">
        <label>
          방향
          <select
            aria-label="정렬 방향"
            value={value.direction}
            onChange={(event) => change({ ...value, direction: event.target.value as LayoutOptions['direction'] })}
          >
            <option value="LR">왼쪽 → 오른쪽</option>
            <option value="TB">위 → 아래</option>
            <option value="RL">오른쪽 → 왼쪽</option>
            <option value="BT">아래 → 위</option>
          </select>
        </label>
        <label>
          계층 간격 (px)
          <input
            aria-label="계층 간격"
            type="number"
            min={20}
            max={500}
            value={value.layerGap}
            onChange={(event) => change({ ...value, layerGap: event.target.valueAsNumber })}
          />
        </label>
        <label>
          노드 간격 (px)
          <input
            aria-label="노드 간격"
            type="number"
            min={20}
            max={500}
            value={value.nodeGap}
            onChange={(event) => change({ ...value, nodeGap: event.target.valueAsNumber })}
          />
        </label>
        <button className="secondary-button" disabled={busy} onClick={apply}>
          설정으로 정렬
        </button>
      </div>
    </details>
  );
}
