import styles from "./FileTree.module.css";
import type { TreeNode } from "../lib/tree";
import { FileRow } from "./FileRow";

interface Props {
  nodes: TreeNode[];
  depth: number;
  active: string | null;
  viewed: ReadonlySet<string>;
  collapsed: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  onSelect: (path: string) => void;
  onFileHistory: (path: string) => void;
  onSymbolHistory: (name: string) => void;
  onToggleViewed: (path: string) => void;
}

const INDENT = 12;

export function FileTree(props: Props): JSX.Element {
  return (
    <>
      {props.nodes.map((node) => {
        if (node.type === "file") {
          return (
            <FileRow
              key={node.file.path}
              file={node.file}
              active={node.file.path === props.active}
              viewed={props.viewed.has(node.file.path)}
              indent={props.depth * INDENT}
              onSelect={() => props.onSelect(node.file.path)}
              onFileHistory={() => props.onFileHistory(node.file.path)}
              onSymbolHistory={props.onSymbolHistory}
              onToggleViewed={() => props.onToggleViewed(node.file.path)}
            />
          );
        }
        const isCollapsed = props.collapsed.has(node.path);
        return (
          <div key={node.path}>
            <button
              className={styles.dir}
              style={{ paddingLeft: 14 + props.depth * INDENT }}
              onClick={() => props.onToggleDir(node.path)}
              title={node.path}
            >
              <span className={styles.caret}>{isCollapsed ? "▸" : "▾"}</span>
              <span className={styles.name}>{node.name}</span>
              <span className={styles.count}>{node.fileCount}</span>
              <span className={styles.stats}>
                <span className={styles.add}>+{node.added}</span>
                <span className={styles.rem}>−{node.removed}</span>
              </span>
            </button>
            {!isCollapsed && <FileTree {...props} nodes={node.children} depth={props.depth + 1} />}
          </div>
        );
      })}
    </>
  );
}
