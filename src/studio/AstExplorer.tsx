import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Focus,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  children,
  Op,
  type Bytecode,
  type Node,
  type SemanticInfo,
  type Span,
} from "../language";
export function nodeLabel(n: Node): string {
  if ("name" in n) return `${n.kind} · ${n.name}`;
  if (n.kind === "Binary" || n.kind === "Unary")
    return `${n.kind} · ${n.operator}`;
  if (n.kind === "Literal") return `${n.kind} · ${JSON.stringify(n.value)}`;
  return n.kind;
}
function TreeNode({
  node,
  depth,
  onSelect,
  selected,
}: {
  node: Node;
  depth: number;
  onSelect: (n: Node) => void;
  selected?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const sub = children(node);
  return (
    <div className="text-tree-node">
      <div className={selected === node.id ? "tree-row selected" : "tree-row"}>
        <button
          className="icon-button"
          aria-label={`${open ? "Collapse" : "Expand"} ${node.kind}`}
          disabled={!sub.length}
          onClick={() => setOpen(!open)}
        >
          {sub.length ? (
            open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="tree-dot" />
          )}
        </button>
        <button onClick={() => onSelect(node)}>
          {nodeLabel(node)} <small>#{node.id}</small>
        </button>
      </div>
      {open && (
        <div className="tree-children">
          {sub.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
interface Placed {
  node: Node;
  x: number;
  y: number;
  parent?: number;
}
function initialCollapsed(root: Node): Set<number> {
  const result = new Set<number>();
  const pending = [{ node: root, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth === 2 && children(node).length) result.add(node.id);
    else
      for (const child of children(node))
        pending.push({ node: child, depth: depth + 1 });
  }
  return result;
}
export function AstExplorer({
  root,
  semantic,
  program,
  onSelect,
}: {
  root: Node;
  semantic?: SemanticInfo;
  program?: Bytecode;
  onSelect: (span: Span) => void;
}) {
  const [mode, setMode] = useState<"graph" | "tree">("graph"),
    [zoom, setZoom] = useState(0.85),
    [collapsed, setCollapsed] = useState<Set<number>>(() =>
      initialCollapsed(root),
    ),
    [selected, setSelected] = useState<Node>();
  const mapped = useMemo(
    () =>
      selected && program
        ? program.instructions
            .map((instruction, address) => ({ instruction, address }))
            .filter(
              ({ instruction }) =>
                instruction.span.start >= selected.span.start &&
                instruction.span.end <= selected.span.end,
            )
        : [],
    [selected, program],
  );
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<
    { x: number; y: number; left: number; top: number } | undefined
  >(undefined);
  const layout = useMemo(() => {
    let leaf = 0;
    const nodes: Placed[] = [];
    let cut = false;
    function visit(node: Node, depth: number, parent?: number): number {
      if (nodes.length >= 300) {
        cut = true;
        return leaf * 65 + 45;
      }
      const entry: Placed = { node, x: depth * 184 + 30, y: 0, parent };
      nodes.push(entry);
      const sub = collapsed.has(node.id) ? [] : children(node);
      const positions = sub.map((n) => visit(n, depth + 1, node.id));
      entry.y = positions.length
        ? (positions[0] + positions[positions.length - 1]) / 2
        : leaf++ * 65 + 45;
      return entry.y;
    }
    visit(root, 0);
    return {
      nodes,
      width: Math.max(...nodes.map((n) => n.x)) + 210,
      height: Math.max(...nodes.map((n) => n.y)) + 65,
      cut,
    };
  }, [root, collapsed]);
  const select = (node: Node) => {
    setSelected(node);
    onSelect(node.span);
  };
  const fit = () => {
    const el = viewport.current;
    if (el) {
      setZoom(
        Math.max(
          0.15,
          Math.min(
            1,
            (el.clientWidth - 30) / layout.width,
            (el.clientHeight - 30) / layout.height,
          ),
        ),
      );
      el.scrollTo(0, 0);
    }
  };
  return (
    <div className="ast-explorer">
      <div className="inspection-toolbar">
        <div className="segmented">
          <button
            className={mode === "graph" ? "active" : ""}
            onClick={() => setMode("graph")}
          >
            Graph
          </button>
          <button
            className={mode === "tree" ? "active" : ""}
            onClick={() => setMode("tree")}
          >
            Tree
          </button>
        </div>
        <span className="micro muted">PARSER OUTPUT</span>
        <div className="toolbar-end">
          <button
            className="icon-button"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
          >
            <Minus size={14} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          >
            <Plus size={14} />
          </button>
          <button
            className="icon-button"
            aria-label="Fit tree"
            title="Fit tree"
            onClick={fit}
          >
            <Focus size={14} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset tree layout"
            title="Reset tree layout"
            onClick={() => {
              setCollapsed(new Set());
              setZoom(0.85);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      {mode === "tree" ? (
        <div className="tree-accessible">
          <TreeNode
            node={root}
            depth={0}
            onSelect={select}
            selected={selected?.id}
          />
        </div>
      ) : (
        <div
          className="graph-viewport"
          ref={viewport}
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-node]")) return;
            const el = viewport.current!;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: el.scrollLeft,
              top: el.scrollTop,
            };
            el.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current && viewport.current) {
              viewport.current.scrollLeft =
                drag.current.left - e.clientX + drag.current.x;
              viewport.current.scrollTop =
                drag.current.top - e.clientY + drag.current.y;
            }
          }}
          onPointerUp={() => {
            drag.current = undefined;
          }}
        >
          <svg
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Abstract syntax tree. Use the Tree tab for an accessible expandable alternative."
          >
            <g className="ast-edges">
              {layout.nodes
                .filter((n) => n.parent)
                .map((n) => {
                  const p = layout.nodes.find((p) => p.node.id === n.parent)!;
                  return (
                    <path
                      key={n.node.id}
                      d={`M ${p.x + 155} ${p.y} C ${p.x + 177} ${p.y}, ${n.x - 22} ${n.y}, ${n.x} ${n.y}`}
                    />
                  );
                })}
            </g>
            {layout.nodes.map(({ node, x, y }) => (
              <g
                key={node.id}
                data-node={node.id}
                transform={`translate(${x},${y - 22})`}
                className={`ast-node ${selected?.id === node.id ? "selected" : ""}`}
                onClick={() => select(node)}
                onDoubleClick={() =>
                  setCollapsed((s) => {
                    const n = new Set(s);
                    if (n.has(node.id)) n.delete(node.id);
                    else n.add(node.id);
                    return n;
                  })
                }
                tabIndex={0}
                role="button"
                aria-label={`${nodeLabel(node)}. Enter to select. Space to toggle children.`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") select(node);
                  if (e.key === " ") {
                    e.preventDefault();
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(node.id)) n.delete(node.id);
                      else n.add(node.id);
                      return n;
                    });
                  }
                }}
              >
                <rect width="155" height="44" rx="5" />
                <rect
                  className="node-accent"
                  width="3"
                  height="18"
                  y="13"
                  rx="1"
                />
                <text x="12" y="18" className="node-kind">
                  {node.kind}
                </text>
                <text x="12" y="33" className="node-value">
                  {nodeLabel(node).split(" · ")[1]?.slice(0, 19) ??
                    `${children(node).length} children`}
                </text>
                <text x="143" y="18" textAnchor="end" className="node-id">
                  {collapsed.has(node.id) ? "+" : `#${node.id}`}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
      {layout.cut && (
        <p className="inspector-note">
          Graph limited to 300 nodes. Use the expandable Tree view for the full
          AST.
        </p>
      )}
      <div className="node-details">
        {selected ? (
          <>
            <span className="tag">{selected.kind}</span>
            <span>
              #{selected.id} · {selected.span.line}:{selected.span.column}
            </span>
            {semantic?.types[selected.id] && (
              <span className="type-value">{semantic.types[selected.id]}</span>
            )}
            <button
              onClick={() =>
                setCollapsed((s) => {
                  const n = new Set(s);
                  if (n.has(selected.id)) n.delete(selected.id);
                  else n.add(selected.id);
                  return n;
                })
              }
            >
              {collapsed.has(selected.id) ? "Expand" : "Collapse"} subtree
            </button>
          </>
        ) : (
          <>
            <span className="selection-dot" />
            Select a node to inspect its source. Double-click to collapse.
          </>
        )}
      </div>
      {selected && program && (
        <details className="mapped-instructions" key={`mapping-${selected.id}`}>
          <summary>{mapped.length} instructions mapped to source</summary>
          <p>
            Instructions whose actual source spans are contained in this node.
            One source expression can emit several instructions.
          </p>
          <div className="mapping-list">
            {mapped.slice(0, 200).map(({ instruction, address }) => (
              <button key={address} onClick={() => onSelect(instruction.span)}>
                <span>{String(address).padStart(4, "0")}</span>
                <strong>{Op[instruction.op]}</strong>
                <span>{instruction.operand ?? ""}</span>
              </button>
            ))}
          </div>
          {mapped.length > 200 && (
            <p>
              Showing the first 200. The Bytecode tab provides the full paged
              listing.
            </p>
          )}
        </details>
      )}
    </div>
  );
}
