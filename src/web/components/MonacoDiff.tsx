import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as monaco from "monaco-editor";
import type { FileDiff } from "../../server/protocol";
import styles from "./MonacoDiff.module.css";

/** Imperative API so keyboard shortcuts can jump between changes. */
export interface MonacoDiffHandle {
  nextChange(): void;
  prevChange(): void;
}

const THEME = "xdiff-light";
let themeDefined = false;

/** Light, Vercel-clean diff theme: white surface, soft mint/salmon tints. */
function ensureTheme(): void {
  if (themeDefined) return;
  monaco.editor.defineTheme(THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorGutter.background": "#ffffff",
      "editorLineNumber.foreground": "#b4b4bb",
      "editorLineNumber.activeForeground": "#3f3f46",
      "diffEditor.insertedLineBackground": "#1f883d14",
      "diffEditor.insertedTextBackground": "#1f883d29",
      "diffEditor.removedLineBackground": "#cf222e12",
      "diffEditor.removedTextBackground": "#cf222e26",
      "diffEditor.diagonalFill": "#ececec",
    },
  });
  themeDefined = true;
}

interface Props {
  file: FileDiff;
  sideBySide: boolean;
  ignoreWhitespace: boolean;
}

export const MonacoDiff = forwardRef<MonacoDiffHandle, Props>(function MonacoDiff(
  { file, sideBySide, ignoreWhitespace },
  ref,
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  // Move the cursor to the next/previous changed hunk in the modified pane.
  useImperativeHandle(ref, () => {
    const go = (dir: 1 | -1): void => {
      const editor = editorRef.current;
      const changes = editor?.getLineChanges();
      if (!editor || !changes || changes.length === 0) return;
      const modified = editor.getModifiedEditor();
      const cur = modified.getPosition()?.lineNumber ?? 1;
      const lines = changes.map((c) => Math.max(1, c.modifiedStartLineNumber));
      const target =
        dir === 1
          ? (lines.find((l) => l > cur) ?? lines[0]!)
          : ([...lines].reverse().find((l) => l < cur) ?? lines[lines.length - 1]!);
      modified.setPosition({ lineNumber: target, column: 1 });
      modified.revealLineInCenter(target);
      modified.focus();
    };
    return { nextChange: () => go(1), prevChange: () => go(-1) };
  }, []);

  // Create the diff editor once.
  useEffect(() => {
    ensureTheme();
    const editor = monaco.editor.createDiffEditor(containerRef.current!, {
      readOnly: true,
      automaticLayout: true,
      renderSideBySide: true,
      ignoreTrimWhitespace: false,
      // Collapse unchanged code, keeping ~5 lines of context around each change.
      hideUnchangedRegions: { enabled: true, contextLineCount: 5, minimumLineCount: 3, revealLineCount: 10 },
      theme: THEME,
    });
    editorRef.current = editor;
    return () => {
      const model = editor.getModel();
      editor.dispose();
      model?.original.dispose();
      model?.modified.dispose();
    };
  }, []);

  // Swap models when the active file changes.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const original = monaco.editor.createModel(file.originalText, file.language);
    const modified = monaco.editor.createModel(file.modifiedText, file.language);
    const prev = editor.getModel();
    editor.setModel({ original, modified });
    prev?.original.dispose();
    prev?.modified.dispose();
  }, [file]);

  // React to UI toggles.
  useEffect(() => {
    editorRef.current?.updateOptions({ renderSideBySide: sideBySide, ignoreTrimWhitespace: ignoreWhitespace });
  }, [sideBySide, ignoreWhitespace]);

  return <div ref={containerRef} className={styles.editor} />;
});
