import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Calculator,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Trash2,
  Copy,
  Check,
  Minus,
  X,
  CornerDownLeft,
  RotateCcw,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PrintCalculadoraData, PrintCalculadoraLinha } from "../types";

export type TapeOp = "+" | "-" | "*" | "/";

export interface TapeRow {
  id: string;
  type: "entry" | "total" | "divider";
  raw: string;
}

interface ParsedEntry {
  kind: "calc" | "text" | "empty";
  op?: TapeOp;
  value?: number;
  numStr?: string;
  comment?: string;
  hasOperatorOnly?: boolean;
}

interface EvaluatedRow extends TapeRow {
  parsed?: ParsedEntry;
  runningAfter?: number;
  totalValue?: number;
  hasDivZeroError?: boolean;
  lineNumber: number;
}

interface TapeCalculatorProps {
  loja: string;
  operador: string;
  onPrintTape: (data: PrintCalculadoraData) => void;
}

const STORAGE_KEY = "caixa_tape_calculator_v1";

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOp(ch: string): TapeOp {
  if (ch === "×" || ch === "x" || ch === "X" || ch === "*") return "*";
  if (ch === "÷" || ch === "/") return "/";
  if (ch === "−" || ch === "-") return "-";
  return "+";
}

function opSymbol(op: TapeOp): string {
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return op;
}

function parseBrNumber(rawToken: string): number | null {
  let clean = rawToken.trim();
  if (!clean) return null;

  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  } else if ((clean.match(/\./g) || []).length > 1) {
    clean = clean.replace(/\./g, "");
  }

  const num = Number(clean);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function formatTapeNumber(val: number, op?: TapeOp): string {
  const safeVal = Math.abs(val) < 1e-9 ? 0 : val;
  if (op === "*" || op === "/") {
    return safeVal.toLocaleString("pt-BR", {
      minimumFractionDigits: Number.isInteger(safeVal) ? 0 : 2,
      maximumFractionDigits: 4
    });
  }
  return safeVal.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCommittedNumStr(numToken: string, op: TapeOp): string {
  const parsed = parseBrNumber(numToken);
  if (parsed === null) return numToken;
  return formatTapeNumber(parsed, op);
}

export function parseTapeLine(raw: string): ParsedEntry {
  if (!raw || raw.trim() === "") {
    return { kind: "empty" };
  }

  // 0. Operator only (e.g. "+ ", "- ", "* ", "/ ") while waiting for digits
  const opOnlyMatch = raw.match(/^\s*([+\-*/×÷−])\s*$/);
  if (opOnlyMatch) {
    return {
      kind: "calc",
      op: normalizeOp(opOnlyMatch[1]),
      numStr: "",
      comment: "",
      hasOperatorOnly: true
    };
  }

  // 1. Suffix style: e.g. "100+" or "100,50- obs"
  const suffixMatch = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*([+\-*/×÷−])(?:\s(.*))?$/);
  if (suffixMatch) {
    const val = parseBrNumber(suffixMatch[1]);
    if (val !== null) {
      return {
        kind: "calc",
        op: normalizeOp(suffixMatch[2]),
        value: val,
        numStr: suffixMatch[1],
        comment: suffixMatch[3] ?? ""
      };
    }
  }

  // 2. Prefix style or bare number: e.g. "+10 PASSAGEM", "+ 10,00 obs", "-20", "/2", "100,00"
  const prefixMatch = raw.match(/^\s*([+\-*/×÷−])?\s*(\d+(?:[.,]\d*)?)(?:\s(.*))?$/);
  if (prefixMatch) {
    const val = parseBrNumber(prefixMatch[2]);
    if (val !== null) {
      return {
        kind: "calc",
        op: prefixMatch[1] ? normalizeOp(prefixMatch[1]) : "+",
        value: val,
        numStr: prefixMatch[2],
        comment: prefixMatch[3] ?? ""
      };
    }
  }

  return {
    kind: "text",
    comment: raw
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function evaluateTape(rows: TapeRow[]): {
  evaluated: EvaluatedRow[];
  currentRunning: number;
  hasPendingOps: boolean;
  hasDivZeroError: boolean;
} {
  let running = 0;
  let hasPendingOps = false;
  let divZeroError = false;
  let lineCounter = 0;

  const evaluated: EvaluatedRow[] = rows.map((row) => {
    lineCounter += 1;

    if (row.type === "divider") {
      running = 0;
      hasPendingOps = false;
      divZeroError = false;
      return {
        ...row,
        lineNumber: lineCounter
      };
    }

    if (row.type === "total") {
      const snapshotTotal = roundMoney(running);
      const snapshotErr = divZeroError;
      hasPendingOps = false;
      return {
        ...row,
        totalValue: snapshotTotal,
        hasDivZeroError: snapshotErr,
        lineNumber: lineCounter
      };
    }

    const parsed = parseTapeLine(row.raw);
    if (parsed.kind === "calc" && !parsed.hasOperatorOnly && parsed.value !== undefined && parsed.op) {
      hasPendingOps = true;
      if (parsed.op === "+") {
        running = roundMoney(running + parsed.value);
      } else if (parsed.op === "-") {
        running = roundMoney(running - parsed.value);
      } else if (parsed.op === "*") {
        running = roundMoney(running * parsed.value);
      } else if (parsed.op === "/") {
        if (parsed.value === 0) {
          divZeroError = true;
        } else {
          running = roundMoney(running / parsed.value);
        }
      }
      return {
        ...row,
        parsed,
        runningAfter: running,
        lineNumber: lineCounter
      };
    }

    return {
      ...row,
      parsed,
      runningAfter: running,
      lineNumber: lineCounter
    };
  });

  return {
    evaluated,
    currentRunning: roundMoney(running),
    hasPendingOps,
    hasDivZeroError: divZeroError
  };
}

const DEFAULT_INTRO_TEXT = "Fita de Cálculo — digite valores (+ - * /) ou textos";

function createInitialRows(): TapeRow[] {
  return [{ id: uid(), type: "entry", raw: "" }];
}

export default function TapeCalculator({ loja, operador, onPrintTape }: TapeCalculatorProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Tape rows with localStorage persistence
  const [rows, setRows] = useState<TapeRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (r: TapeRow) => !(r.type === "entry" && r.raw.trim() === DEFAULT_INTRO_TEXT)
          );
          return cleaned.length > 0 ? cleaned : createInitialRows();
        }
      }
    } catch {}
    return createInitialRows();
  });

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<TapeRow[][]>([]);
  const [redoStack, setRedoStack] = useState<TapeRow[][]>([]);

  // Focus & active line tracking
  const [activeRowId, setActiveRowId] = useState<string>(() => rows[rows.length - 1]?.id || "");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const commentRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Draggable window offset (desktop)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Persist automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  // Evaluate entire tape dynamically
  const { evaluated, currentRunning, hasPendingOps, hasDivZeroError } = useMemo(
    () => evaluateTape(rows),
    [rows]
  );

  const flashStatus = useCallback((msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 1800);
  }, []);

  // Helper to commit a state transition with undo history
  const commitRows = useCallback(
    (nextRows: TapeRow[], recordUndo = true) => {
      if (recordUndo) {
        setUndoStack((prev) => [...prev.slice(-39), rows]);
        setRedoStack([]);
      }
      setIsAllSelected(false);
      setRows(nextRows);
    },
    [rows]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, rows]);
    setUndoStack((u) => u.slice(0, -1));
    setIsAllSelected(false);
    setRows(prev);
  }, [undoStack, rows]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, rows]);
    setRedoStack((r) => r.slice(0, -1));
    setIsAllSelected(false);
    setRows(next);
  }, [redoStack, rows]);

  // Focus row programmatically — only sets caret position when explicitly requested
  const focusRow = useCallback((id: string, cursorPos?: number, focusComment = false) => {
    setActiveRowId(id);
    requestAnimationFrame(() => {
      const el = focusComment ? commentRefs.current[id] : inputRefs.current[id];
      if (el) {
        el.focus();
        if (typeof cursorPos === "number") {
          const clamped = Math.max(0, Math.min(cursorPos, el.value.length));
          el.setSelectionRange(clamped, clamped);
        }
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }, []);

  // Focus last editable row when opening
  useEffect(() => {
    if (isOpen) {
      const editableRows = rows.filter((r) => r.type === "entry");
      const target =
        editableRows.find((r) => r.id === activeRowId) ||
        editableRows[editableRows.length - 1];
      if (target) {
        setTimeout(() => focusRow(target.id), 60);
      }
    } else {
      setIsAllSelected(false);
    }
  }, [isOpen]);

  // Build plain-text representation of entire tape for Ctrl+C copy
  const buildTapePlainText = useCallback((): string => {
    return evaluated
      .map((row) => {
        if (row.type === "divider") return "-------- NOVA CONTA --------";
        if (row.type === "total") {
          const val = row.totalValue ?? 0;
          const sign = val < 0 ? "-" : "+";
          const formatted = row.hasDivZeroError ? "Erro (/0)" : formatTapeNumber(Math.abs(val));
          return `================\n${sign} ${formatted}`;
        }
        if (row.parsed?.kind === "calc" && !row.parsed.hasOperatorOnly && row.parsed.op && row.parsed.value !== undefined) {
          const numStr = formatTapeNumber(row.parsed.value, row.parsed.op);
          const comment = row.parsed.comment ? `  ${row.parsed.comment}` : "";
          return `${opSymbol(row.parsed.op)} ${numStr}${comment}`;
        }
        return row.raw;
      })
      .join("\n");
  }, [evaluated]);

  const handleCopyAllTape = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildTapePlainText());
      flashStatus("Toda a fita copiada!");
    } catch {}
  }, [buildTapePlainText, flashStatus]);

  const handleClearAll = useCallback(() => {
    const freshId = uid();
    commitRows([{ id: freshId, type: "entry", raw: "" }]);
    flashStatus("Fita limpa!");
    setTimeout(() => focusRow(freshId, 0), 20);
  }, [commitRows, flashStatus, focusRow]);

  const handlePrint = useCallback(() => {
    const linhas: PrintCalculadoraLinha[] = evaluated
      .filter((row) => {
        if (row.type === "divider" || row.type === "total") return true;
        if (row.parsed?.hasOperatorOnly) return false;
        const trimmed = row.raw.trim();
        if (!trimmed || trimmed === DEFAULT_INTRO_TEXT) return false;
        return true;
      })
      .map((row) => {
        if (row.type === "divider") {
          return { type: "divider" };
        }
        if (row.type === "total") {
          const val = row.totalValue ?? 0;
          return {
            type: "total",
            isNeg: val < 0,
            hasError: row.hasDivZeroError,
            formattedValue: formatTapeNumber(Math.abs(val))
          };
        }
        if (row.parsed?.kind === "calc" && !row.parsed.hasOperatorOnly && row.parsed.op && row.parsed.value !== undefined) {
          return {
            type: "entry",
            kind: "calc",
            op: opSymbol(row.parsed.op),
            formattedValue: formatTapeNumber(row.parsed.value, row.parsed.op),
            comment: row.parsed.comment || ""
          };
        }
        return {
          type: "entry",
          kind: "text",
          raw: row.raw
        };
      });

    onPrintTape({
      loja: loja || "TERMINAL DE CAIXA",
      operador: operador || "OPERADOR",
      dataHora: new Date().toLocaleString("pt-BR"),
      linhas,
      saldoFinal: currentRunning
    });
  }, [evaluated, loja, operador, currentRunning, onPrintTape]);

  // Global window shortcuts while calculator is OPEN:
  // - Alt + I -> Print tape
  // - Esc -> Clear all
  // - Ctrl + C / Backspace / Delete (when isAllSelected)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalCalcKeys = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClearAll();
        return;
      }

      if (isAllSelected) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          e.preventDefault();
          e.stopPropagation();
          handleCopyAllTape();
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          handleClearAll();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalCalcKeys, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalCalcKeys, true);
    };
  }, [isOpen, isAllSelected, handlePrint, handleClearAll, handleCopyAllTape]);

  // Dragging handlers for desktop floating header
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current?.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      setDragOffset({
        x: dragStateRef.current.origX + dx,
        y: dragStateRef.current.origY + dy
      });
    };
    const onPointerUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current.dragging = false;
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    if (window.innerWidth < 768) return;
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: dragOffset.x,
      origY: dragOffset.y
    };
  };

  // Handler for plain/empty lines transitioning into either calc (number/operator) or text
  const handlePlainRowChange = (id: string, value: string) => {
    setIsAllSelected(false);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;

    if (value.endsWith("=") && hasPendingOps && value.trim() === "=") {
      insertTotalAtActive();
      return;
    }

    // Check if user just started typing an operator or a digit on a blank line
    const parsed = parseTapeLine(value);
    if (parsed.kind === "calc") {
      // Check if user typed suffix operator e.g. "10+"
      const opAtEndMatch = value.match(/^\s*(\d+(?:[.,]\d+)?)\s*([+\-*/×÷−])$/);
      if (opAtEndMatch) {
        const currentLineRaw = `+ ${formatCommittedNumStr(opAtEndMatch[1], "+")}`;
        const nextOp = normalizeOp(opAtEndMatch[2]);
        const nextEntryId = uid();
        const updated = [...rows];
        updated[idx] = { ...updated[idx], raw: currentLineRaw };
        updated.splice(idx + 1, 0, { id: nextEntryId, type: "entry", raw: `${nextOp} ` });
        commitRows(updated);
        focusRow(nextEntryId, 0);
        return;
      }

      const normalized = parsed.hasOperatorOnly
        ? `${parsed.op} `
        : `${parsed.op} ${parsed.numStr}${parsed.comment ? ` ${parsed.comment}` : ""}`;
      const updated = rows.map((r) => (r.id === id ? { ...r, raw: normalized } : r));
      setRows(updated);
      // Focus aligned number input immediately without timeout
      focusRow(id, (parsed.numStr || "").length);
      return;
    }

    const updated = rows.map((r) => (r.id === id ? { ...r, raw: value } : r));
    setRows(updated);
  };

  // Format number cleanly when leaving the number input (e.g. 10 -> 10,00)
  const handleCalcNumBlur = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || r.type !== "entry") return r;
        const p = parseTapeLine(r.raw);
        if (p.kind !== "calc" || p.hasOperatorOnly || !p.numStr || !p.op) return r;
        const formattedNum = formatCommittedNumStr(p.numStr, p.op);
        if (formattedNum === p.numStr) return r;
        return {
          ...r,
          raw: `${p.op} ${formattedNum}${p.comment ? ` ${p.comment}` : ""}`
        };
      })
    );
  };

  // Handler for the right-aligned Number <input> inside an aligned calc row
  const handleCalcNumChange = (id: string, op: TapeOp, comment: string, newNumVal: string) => {
    setIsAllSelected(false);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;

    // 1. User typed "=" -> close operation and compute total
    if (newNumVal.endsWith("=")) {
      const cleanNum = newNumVal.slice(0, -1).trim();
      const updated = [...rows];
      if (cleanNum === "" && hasPendingOps) {
        const totalId = uid();
        const nextEntryId = uid();
        updated.splice(
          idx,
          1,
          { id: totalId, type: "total", raw: "" },
          { id: nextEntryId, type: "entry", raw: "" }
        );
        commitRows(updated);
        setTimeout(() => focusRow(nextEntryId, 0), 20);
        return;
      }
      if (/^\d+(?:[.,]\d*)?$/.test(cleanNum)) {
        updated[idx] = {
          ...updated[idx],
          raw: `${op} ${formatCommittedNumStr(cleanNum, op)}${comment ? ` ${comment}` : ""}`
        };
        const totalId = uid();
        const nextEntryId = uid();
        updated.splice(
          idx + 1,
          0,
          { id: totalId, type: "total", raw: "" },
          { id: nextEntryId, type: "entry", raw: "" }
        );
        commitRows(updated);
        setTimeout(() => focusRow(nextEntryId, 0), 20);
        return;
      }
    }

    // 2. User typed an operator (+, -, *, /) at the end (e.g. "10+"):
    // keep this number in its aligned column and drop the operator to the line BELOW!
    const opAtEndMatch = newNumVal.match(/^\s*(\d+(?:[.,]\d+)?)\s*([+\-*/×÷−])$/);
    if (opAtEndMatch) {
      const nextOp = normalizeOp(opAtEndMatch[2]);
      const nextEntryId = uid();
      const updated = [...rows];
      updated[idx] = {
        ...updated[idx],
        raw: `${op} ${formatCommittedNumStr(opAtEndMatch[1], op)}${comment ? ` ${comment}` : ""}`
      };
      updated.splice(idx + 1, 0, { id: nextEntryId, type: "entry", raw: `${nextOp} ` });
      commitRows(updated);
      setTimeout(() => focusRow(nextEntryId, 0), 20);
      return;
    }

    // 3. Operator typed when number is still empty -> switch operator on this line
    if (/^\s*[+\-*/×÷−]\s*$/.test(newNumVal)) {
      const switchedOp = normalizeOp(newNumVal.trim());
      const updated = rows.map((r) => (r.id === id ? { ...r, raw: `${switchedOp} ` } : r));
      setRows(updated);
      return;
    }

    // 4. User typed Space in number field -> move seamlessly into Comment field!
    if (newNumVal.includes(" ")) {
      const spaceIdx = newNumVal.indexOf(" ");
      const numOnly = newNumVal.slice(0, spaceIdx);
      const typedAfterSpace = newNumVal.slice(spaceIdx + 1);
      const nextComment = typedAfterSpace + (comment ? (typedAfterSpace ? " " : "") + comment : "");
      const updated = rows.map((r) =>
        r.id === id
          ? { ...r, raw: `${op} ${numOnly} ${nextComment}` }
          : r
      );
      setRows(updated);
      setTimeout(() => focusRow(id, typedAfterSpace.length, true), 10);
      return;
    }

    // 5. Normal numeric edit (digits, comma, dot)
    if (/^[\d.,]*$/.test(newNumVal)) {
      const nextRaw = newNumVal === "" && !comment
        ? `${op} `
        : `${op} ${newNumVal}${comment ? ` ${comment}` : ""}`;
      const updated = rows.map((r) => (r.id === id ? { ...r, raw: nextRaw } : r));
      setRows(updated);
      return;
    }

    // 6. User typed letters directly -> if comment was empty and no explicit non-plus op, convert to text
    const combinedText = `${newNumVal}${comment ? ` ${comment}` : ""}`;
    const updated = rows.map((r) => (r.id === id ? { ...r, raw: combinedText } : r));
    setRows(updated);
  };

  // Handler for the aligned Comment <input> (to the right of the number column)
  const handleCalcCommentChange = (id: string, op: TapeOp, numStr: string, newComment: string) => {
    setIsAllSelected(false);
    const updated = rows.map((r) =>
      r.id === id
        ? { ...r, raw: newComment === "" ? `${op} ${numStr}` : `${op} ${numStr} ${newComment}` }
        : r
    );
    setRows(updated);
  };

  const insertTotalAtActive = () => {
    let idx = rows.findIndex((r) => r.id === activeRowId);
    if (idx === -1) idx = rows.length - 1;

    const currentRow = rows[idx];
    const updated = [...rows];
    const totalId = uid();
    const nextEntryId = uid();

    if (currentRow && currentRow.type === "entry" && currentRow.raw.trim() === "") {
      updated.splice(
        idx,
        1,
        { id: totalId, type: "total", raw: "" },
        { id: nextEntryId, type: "entry", raw: "" }
      );
    } else {
      updated.splice(
        idx + 1,
        0,
        { id: totalId, type: "total", raw: "" },
        { id: nextEntryId, type: "entry", raw: "" }
      );
    }

    commitRows(updated);
    setTimeout(() => focusRow(nextEntryId, 0), 20);
  };

  const handleInsertDividerReset = () => {
    let idx = rows.findIndex((r) => r.id === activeRowId);
    if (idx === -1) idx = rows.length - 1;

    const updated = [...rows];
    const divId = uid();
    const nextEntryId = uid();

    const currentRow = updated[idx];
    if (currentRow && currentRow.type === "entry" && currentRow.raw.trim() === "") {
      updated.splice(
        idx,
        1,
        { id: divId, type: "divider", raw: "" },
        { id: nextEntryId, type: "entry", raw: "" }
      );
    } else {
      updated.splice(
        idx + 1,
        0,
        { id: divId, type: "divider", raw: "" },
        { id: nextEntryId, type: "entry", raw: "" }
      );
    }

    commitRows(updated);
    setTimeout(() => focusRow(nextEntryId, 0), 20);
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: TapeRow,
    idx: number,
    source: "plain" | "num" | "comment"
  ) => {
    // Ctrl + A -> Select ALL lines in the entire tape
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      e.stopPropagation();
      setIsAllSelected(true);
      flashStatus("Tudo selecionado (Ctrl+C copia • Backspace/Esc limpa)");
      return;
    }

    if (isAllSelected && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleClearAll();
        return;
      }
      if (e.key.length === 1) {
        setIsAllSelected(false);
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }

    const inputEl = e.currentTarget;
    const selStart = inputEl.selectionStart ?? 0;
    const selEnd = inputEl.selectionEnd ?? 0;
    const parsed = parseTapeLine(row.raw);

    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = row.raw.trim();

      // 0. Cursor at very start (in front of "+10" or text) -> push row down with blank line above
      if (
        (source === "num" || source === "plain") &&
        selStart === 0 &&
        selEnd === 0 &&
        trimmed !== "" &&
        !parsed.hasOperatorOnly
      ) {
        const blankAboveId = uid();
        const nextRows = [...rows];
        nextRows.splice(idx, 0, { id: blankAboveId, type: "entry", raw: "" });
        commitRows(nextRows);
        setTimeout(() => focusRow(row.id, 0), 20);
        return;
      }

      // 1. Bare operator only (e.g. "+ ") with no number typed yet:
      if (parsed.hasOperatorOnly) {
        if (hasPendingOps) {
          const updated = [...rows];
          const totalId = uid();
          const nextEntryId = uid();
          updated.splice(
            idx,
            1,
            { id: totalId, type: "total", raw: "" },
            { id: nextEntryId, type: "entry", raw: "" }
          );
          commitRows(updated);
          setTimeout(() => focusRow(nextEntryId, 0), 20);
        } else {
          const nextEntry = rows.slice(idx + 1).find((r) => r.type === "entry");
          if (nextEntry) {
            focusRow(nextEntry.id, 0);
          } else {
            const newId = uid();
            commitRows([...rows, { id: newId, type: "entry", raw: "" }]);
            setTimeout(() => focusRow(newId, 0), 20);
          }
        }
        return;
      }

      // 2. Empty line: if pending ops exist above, total; otherwise jump to next line
      if (trimmed === "") {
        if (hasPendingOps) {
          insertTotalAtActive();
          return;
        }
        const nextEntry = rows.slice(idx + 1).find((r) => r.type === "entry");
        if (nextEntry) {
          focusRow(nextEntry.id, 0);
        } else {
          const newId = uid();
          commitRows([...rows, { id: newId, type: "entry", raw: "" }]);
          setTimeout(() => focusRow(newId, 0), 20);
        }
        return;
      }

      // 3. Calculation line -> Enter triggers "=" total!
      if (parsed.kind === "calc") {
        const nextRows = [...rows];
        if (parsed.numStr && parsed.op) {
          nextRows[idx] = {
            ...nextRows[idx],
            raw: `${parsed.op} ${formatCommittedNumStr(parsed.numStr, parsed.op)}${
              parsed.comment ? ` ${parsed.comment}` : ""
            }`
          };
        }
        const nextRow = nextRows[idx + 1];
        if (nextRow && nextRow.type === "total") {
          const afterTotalEntry = nextRows.slice(idx + 2).find((r) => r.type === "entry");
          commitRows(nextRows);
          if (afterTotalEntry) {
            setTimeout(() => focusRow(afterTotalEntry.id), 20);
          }
          return;
        }

        const totalId = uid();
        const nextEntryId = uid();
        nextRows.splice(
          idx + 1,
          0,
          { id: totalId, type: "total", raw: "" },
          { id: nextEntryId, type: "entry", raw: "" }
        );
        commitRows(nextRows);
        setTimeout(() => focusRow(nextEntryId, 0), 20);
        return;
      }

      // 4. Text line -> Enter simply skips to the next line
      const newId = uid();
      const nextRows = [...rows];
      nextRows.splice(idx + 1, 0, { id: newId, type: "entry", raw: "" });
      commitRows(nextRows);
      setTimeout(() => focusRow(newId, 0), 20);
      return;
    }

    // Seamless horizontal navigation between Number and Comment fields
    if (source === "num" && e.key === "ArrowRight" && selStart === inputEl.value.length) {
      if (commentRefs.current[row.id]) {
        e.preventDefault();
        focusRow(row.id, 0, true);
        return;
      }
    }

    if (source === "comment" && (e.key === "ArrowLeft" || e.key === "Backspace") && selStart === 0 && selEnd === 0) {
      e.preventDefault();
      const numEl = inputRefs.current[row.id];
      if (numEl) {
        focusRow(row.id, numEl.value.length, false);
      }
      return;
    }

    // Backspace when Number field is empty with bare operator -> clear operator back to plain empty row
    if (source === "num" && e.key === "Backspace" && parsed.hasOperatorOnly) {
      e.preventDefault();
      const updated = rows.map((r) => (r.id === row.id ? { ...r, raw: "" } : r));
      setRows(updated);
      setTimeout(() => focusRow(row.id, 0, false), 10);
      return;
    }

    // Backspace on completely empty row -> remove row and focus previous row
    if (source === "plain" && e.key === "Backspace" && row.raw === "" && rows.length > 1) {
      e.preventDefault();
      const prevRows = rows.filter((r) => r.id !== row.id);
      let target: TapeRow | undefined;
      for (let i = idx - 1; i >= 0; i--) {
        if (rows[i].type === "entry") {
          target = rows[i];
          break;
        }
      }
      if (!target) {
        target = prevRows.find((r) => r.type === "entry");
      }
      commitRows(prevRows);
      if (target) {
        const targetParsed = parseTapeLine(target.raw);
        setTimeout(
          () => focusRow(target!.id, (targetParsed.numStr ?? target!.raw).length, false),
          20
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      for (let i = idx - 1; i >= 0; i--) {
        if (rows[i].type === "entry") {
          e.preventDefault();
          focusRow(rows[i].id, undefined, false);
          return;
        }
      }
    }

    if (e.key === "ArrowDown") {
      for (let i = idx + 1; i < rows.length; i++) {
        if (rows[i].type === "entry") {
          e.preventDefault();
          focusRow(rows[i].id, undefined, false);
          return;
        }
      }
    }
  };

  // Quick operator button injection: if active line already has content, insert operator on a NEW line below
  const applyOperatorToActive = (op: TapeOp) => {
    let targetId = activeRowId;
    let idx = rows.findIndex((r) => r.id === targetId && r.type === "entry");
    if (idx === -1) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].type === "entry") {
          idx = i;
          targetId = rows[i].id;
          break;
        }
      }
    }
    if (idx === -1) {
      const newId = uid();
      commitRows([...rows, { id: newId, type: "entry", raw: `${op} ` }]);
      setTimeout(() => focusRow(newId, 0), 20);
      return;
    }

    const row = rows[idx];
    const isEmptyOrOnlyOp = /^\s*[+\-*/×÷−]?\s*$/.test(row.raw);

    if (!isEmptyOrOnlyOp) {
      let committedRaw = row.raw;
      const parsed = parseTapeLine(committedRaw);
      if (parsed.kind === "calc" && !/^\s*[+\-*/×÷−]/.test(committedRaw)) {
        committedRaw = `+ ${committedRaw.trimStart()}`;
      }
      const nextEntryId = uid();
      const updated = [...rows];
      updated[idx] = { ...row, raw: committedRaw };
      updated.splice(idx + 1, 0, { id: nextEntryId, type: "entry", raw: `${op} ` });
      commitRows(updated);
      setTimeout(() => focusRow(nextEntryId, 0), 20);
      return;
    }

    const nextRaw = `${op} `;
    const updated = rows.map((r) => (r.id === targetId ? { ...r, raw: nextRaw } : r));
    setRows(updated);
    setTimeout(() => focusRow(targetId, 0), 20);
  };

  const deleteSpecialRow = (id: string) => {
    const nextRows = rows.filter((r) => r.id !== id);
    if (nextRows.length === 0) {
      const freshId = uid();
      commitRows([{ id: freshId, type: "entry", raw: "" }]);
    } else {
      commitRows(nextRows);
    }
  };

  const handleCopyValue = async (val: number, id: string) => {
    const formatted = formatTapeNumber(val);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1600);
    } catch {}
  };

  const activeLineNumber = useMemo(() => {
    const found = evaluated.find((r) => r.id === activeRowId);
    return found ? found.lineNumber : evaluated.length;
  }, [evaluated, activeRowId]);

  const fontSizePx = Math.round(14 * (zoomPct / 100));
  const rowMinHeightPx = Math.round(32 * (zoomPct / 100));

  return (
    <>
      {/* Floating Circular Icon Button (Always Accessible) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "Minimizar Calculadora Fita" : "Abrir Calculadora Fita"}
        aria-label={isOpen ? "Minimizar Calculadora Fita" : "Abrir Calculadora Fita"}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[950] w-14 h-14 rounded-full bg-[#0d1926] hover:bg-[#13263a] text-white border-2 border-emerald-400/70 shadow-[0_8px_28px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer no-print"
      >
        <Calculator className={`w-6 h-6 transition-colors ${isOpen ? "text-sky-400" : "text-emerald-400"}`} />
        {!isOpen && currentRunning !== 0 && (
          <span
            className={`absolute -top-2 -left-2 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-black shadow border border-slate-900 ${
              currentRunning < 0
                ? "bg-rose-500 text-white"
                : "bg-emerald-400 text-slate-950"
            }`}
          >
            {currentRunning < 0 ? "-" : ""}
            {formatTapeNumber(Math.abs(currentRunning))}
          </span>
        )}
      </button>

      {/* Floating CalcTape-Style Calculator Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
                : undefined
            }
            className={`fixed z-[960] no-print flex flex-col bg-[#0d1926] text-slate-100 border border-[#243b55] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden ${
              isExpanded
                ? "inset-x-3 top-14 bottom-20 md:inset-auto md:bottom-24 md:right-6 md:w-[540px] md:h-[640px] md:max-h-[calc(100vh-110px)]"
                : "inset-x-3 bottom-20 h-[62vh] max-h-[520px] md:inset-auto md:bottom-24 md:right-6 md:w-[430px] md:h-[520px] md:max-h-[calc(100vh-110px)]"
            }`}
          >
            {/* Window Header (Draggable on desktop) */}
            <div
              onPointerDown={startDrag}
              className="bg-[#112233] border-b border-[#1f364d] px-3.5 py-2.5 flex items-center justify-between select-none md:cursor-grab md:active:cursor-grabbing shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans text-xs font-black tracking-wide text-white">
                      Calculadora Fita
                    </span>
                    <GripHorizontal className="w-3.5 h-3.5 text-slate-500 hidden md:inline" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block leading-none">
                    Alt+I Imprimir • Esc Limpar • Ctrl+A Selecionar
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  title={isExpanded ? "Tamanho padrão" : "Expandir"}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1b334a] transition-colors cursor-pointer"
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimizar para ícone circular"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1b334a] transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Fechar janela (mantém salvo)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CalcTape-Style Toolbar */}
            <div className="bg-[#0f1e2e] border-b border-[#1c3047] px-2.5 py-1.5 flex items-center justify-between gap-1 shrink-0">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  title="Desfazer (Ctrl+Z)"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a3047] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Refazer"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a3047] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>

                <span className="h-4 w-px bg-[#1f364d] mx-1" />

                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.max(80, z - 10))}
                  title="Diminuir texto"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a3047] transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[10px] font-bold text-slate-200 bg-[#182b40] px-2 py-0.5 rounded-full border border-[#243d59]">
                  {zoomPct}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.min(140, z + 10))}
                  title="Aumentar texto"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-[#1a3047] transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <span className="h-4 w-px bg-[#1f364d] mx-1" />

                <button
                  type="button"
                  onClick={() => setShowHelp((h) => !h)}
                  title="Como usar"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showHelp ? "bg-sky-500/20 text-sky-400" : "text-slate-300 hover:bg-[#1a3047]"
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrint}
                  title="Imprimir Fita (Alt + I)"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono text-sky-300 hover:bg-sky-500/15 border border-transparent hover:border-sky-500/30 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={handleInsertDividerReset}
                  title="Zerar para iniciar nova soma abaixo"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Nova</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="Limpar toda a fita (Esc)"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </div>
            </div>

            {/* Optional Quick Help Banner */}
            {showHelp && (
              <div className="bg-[#13293f] border-b border-sky-500/30 px-3.5 py-2.5 text-[11px] text-slate-200 space-y-1 shrink-0 font-sans">
                <div className="font-bold text-sky-300 flex items-center justify-between">
                  <span>Atalhos & Guia Rápido:</span>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  • Digite um valor e aperte <code className="text-emerald-300 font-mono">+</code>,{" "}
                  <code className="text-rose-400 font-mono">-</code>,{" "}
                  <code className="text-amber-300 font-mono">*</code> ou{" "}
                  <code className="text-sky-300 font-mono">/</code> para ir direto para a linha de baixo com o sinal.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  • <kbd className="bg-[#0b1622] px-1 rounded border border-slate-600 font-mono text-[10px]">Enter</kbd> (ou <code className="text-emerald-300 font-mono">=</code>) fecha a operação e mostra o total. No início da linha (antes do valor) ou em textos, <kbd className="bg-[#0b1622] px-1 rounded border border-slate-600 font-mono text-[10px]">Enter</kbd> pula linha.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  • <kbd className="bg-[#0b1622] px-1 rounded border border-slate-600 font-mono text-[10px]">Alt+I</kbd> Imprime • <kbd className="bg-[#0b1622] px-1 rounded border border-slate-600 font-mono text-[10px]">Esc</kbd> Limpa tudo • <kbd className="bg-[#0b1622] px-1 rounded border border-slate-600 font-mono text-[10px]">Ctrl+A</kbd> Seleciona tudo.
                </p>
              </div>
            )}

            {/* Ruled Paper Tape Body */}
            <div
              ref={scrollContainerRef}
              onClick={() => {
                setIsAllSelected(false);
                const lastEntry = [...rows].reverse().find((r) => r.type === "entry");
                if (lastEntry) {
                  const p = parseTapeLine(lastEntry.raw);
                  focusRow(lastEntry.id, (p.numStr ?? lastEntry.raw).length, false);
                }
              }}
              className="flex-1 overflow-y-auto bg-[#0b1622] select-text cursor-text"
            >
              {evaluated.map((row, idx) => {
                const isActive = row.id === activeRowId;

                if (row.type === "divider") {
                  return (
                    <div
                      key={row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAllSelected(false);
                      }}
                      style={{ minHeight: `${rowMinHeightPx}px` }}
                      className={`group border-b border-[#182c42] px-3 flex items-center justify-between ${
                        isAllSelected ? "bg-sky-500/20" : "bg-[#0e1d2d]"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-amber-400/80 w-full">
                        <span className="flex-1 border-t border-dashed border-amber-500/40" />
                        <span>Nova Conta (Zerada)</span>
                        <span className="flex-1 border-t border-dashed border-amber-500/40" />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSpecialRow(row.id)}
                        title="Remover separador"
                        className="opacity-0 group-hover:opacity-100 ml-2 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (row.type === "total") {
                  const val = row.totalValue ?? 0;
                  const isNeg = val < 0;
                  const isCopied = copiedId === row.id;

                  return (
                    <div
                      key={row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAllSelected(false);
                      }}
                      className={`group border-b border-[#182c42] px-3 py-1 ${
                        isAllSelected ? "bg-sky-500/25" : "bg-[#0c1a28]"
                      }`}
                    >
                      <div className="w-40 border-t border-b border-slate-400/60 h-[3px] mb-1 ml-1" />
                      <div
                        style={{ fontSize: `${fontSizePx}px`, minHeight: `${rowMinHeightPx - 4}px` }}
                        className="flex items-center font-mono"
                      >
                        <span
                          className={`w-6 text-center font-bold shrink-0 ${
                            isNeg ? "text-rose-400" : "text-slate-300"
                          }`}
                        >
                          {isNeg ? "-" : "+"}
                        </span>

                        {row.hasDivZeroError ? (
                          <span className="w-28 text-right font-bold text-rose-400 shrink-0">
                            Erro (/0)
                          </span>
                        ) : (
                          <span
                            className={`w-28 text-right font-black tabular-nums shrink-0 ${
                              isNeg ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {formatTapeNumber(Math.abs(val))}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 pl-3 flex-1">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(val, row.id)}
                            title="Copiar resultado"
                            className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSpecialRow(row.id)}
                            title="Remover linha de total"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer ml-auto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Entry row:
                // - If it's a calculation line (`calc`), render in the EXACT same fixed columns
                //   as the green Total row: [w-6 operator] [w-28 text-right number] [flex-1 pl-3 comment]
                //   so +10 always sits directly aligned above the green result and never shifts!
                // - If it's empty or plain text, render full-width monospace input.
                const parsed = row.parsed || { kind: "empty" };
                const isCalc = parsed.kind === "calc" && parsed.op !== undefined;

                return (
                  <div
                    key={row.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAllSelected(false);
                      setActiveRowId(row.id);
                    }}
                    style={{
                      minHeight: `${rowMinHeightPx}px`,
                      fontSize: `${fontSizePx}px`
                    }}
                    className={`relative border-b border-[#182c42] px-3 flex items-center font-mono transition-colors ${
                      isAllSelected
                        ? "bg-sky-500/25 border-l-4 border-l-sky-400 pl-2"
                        : isActive
                        ? "bg-[#102b44] border-l-4 border-l-sky-400 pl-2"
                        : "hover:bg-[#0f1f30]"
                    }`}
                  >
                    {isCalc ? (
                      <div className="flex items-center w-full">
                        {/* Col 1: Fixed operator column matching total row */}
                        <span
                          onClick={() => focusRow(row.id, 0, false)}
                          className={`w-6 text-center font-bold shrink-0 select-none ${
                            parsed.op === "-"
                              ? "text-rose-400"
                              : parsed.op === "*"
                              ? "text-amber-300"
                              : parsed.op === "/"
                              ? "text-sky-300"
                              : "text-slate-200"
                          }`}
                        >
                          {opSymbol(parsed.op!)}
                        </span>

                        {/* Col 2: Fixed right-aligned number column directly over green total */}
                        <input
                          ref={(el) => {
                            inputRefs.current[row.id] = el;
                          }}
                          type="text"
                          value={parsed.numStr || ""}
                          onChange={(e) =>
                            handleCalcNumChange(
                              row.id,
                              parsed.op!,
                              parsed.comment || "",
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => handleRowKeyDown(e, row, idx, "num")}
                          onBlur={() => handleCalcNumBlur(row.id)}
                          onFocus={() => {
                            setIsAllSelected(false);
                            setActiveRowId(row.id);
                          }}
                          placeholder="0,00"
                          className={`w-28 text-right tabular-nums shrink-0 bg-transparent outline-none font-mono py-1 placeholder:text-slate-600/70 caret-sky-400 selection:bg-sky-400/35 ${
                            parsed.op === "-"
                              ? "text-rose-400 font-semibold"
                              : parsed.op === "*"
                              ? "text-amber-200 font-semibold"
                              : parsed.op === "/"
                              ? "text-sky-200 font-semibold"
                              : "text-slate-100 font-semibold"
                          }`}
                          autoComplete="off"
                          spellCheck={false}
                        />

                        {/* Col 3: Inline comment field — cursor moves freely without shifting the number! */}
                        <input
                          ref={(el) => {
                            commentRefs.current[row.id] = el;
                          }}
                          type="text"
                          value={parsed.comment || ""}
                          onChange={(e) =>
                            handleCalcCommentChange(
                              row.id,
                              parsed.op!,
                              parsed.numStr || "",
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => handleRowKeyDown(e, row, idx, "comment")}
                          onFocus={() => {
                            setIsAllSelected(false);
                            setActiveRowId(row.id);
                          }}
                          className="flex-1 min-w-0 pl-3 bg-transparent outline-none font-sans text-xs sm:text-sm text-slate-400 caret-sky-400 selection:bg-sky-400/35 py-1"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      <input
                        ref={(el) => {
                          inputRefs.current[row.id] = el;
                        }}
                        type="text"
                        value={row.raw}
                        onChange={(e) => handlePlainRowChange(row.id, e.target.value)}
                        onKeyDown={(e) => handleRowKeyDown(e, row, idx, "plain")}
                        onFocus={() => {
                          setIsAllSelected(false);
                          setActiveRowId(row.id);
                        }}
                        placeholder={
                          isActive && idx === rows.length - 1
                            ? "Ex: + 100,00  |  - 50,00  |  * 2  |  / 4  |  ou texto..."
                            : ""
                        }
                        className="w-full bg-transparent text-slate-200 placeholder:text-slate-500/70 placeholder:text-xs outline-none font-sans text-xs sm:text-sm caret-sky-400 selection:bg-sky-400/35 py-1"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Operators & Total Action Bar */}
            <div className="bg-[#102031] border-t border-[#1f364d] px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {(["+", "-", "*", "/"] as TapeOp[]).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => applyOperatorToActive(op)}
                    title={
                      op === "+"
                        ? "Somar (+)"
                        : op === "-"
                        ? "Subtrair (-)"
                        : op === "*"
                        ? "Multiplicar (*)"
                        : "Dividir (/)"
                    }
                    className={`w-8 h-8 rounded-lg font-mono text-sm font-black border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                      op === "-"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
                        : op === "*"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                        : op === "/"
                        ? "bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25"
                        : "bg-slate-700/40 text-white border-slate-600/60 hover:bg-slate-700/70"
                    }`}
                  >
                    {opSymbol(op)}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={insertTotalAtActive}
                  disabled={!hasPendingOps}
                  title="Fechar operação e exibir total (Enter ou =)"
                  className="ml-1 h-8 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-slate-400 text-slate-950 font-sans text-xs font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>=</span>
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </div>

              {/* Live Running Subtotal Pill */}
              <button
                type="button"
                onClick={() => handleCopyValue(currentRunning, "live_subtotal")}
                title="Clique para copiar o saldo atual"
                className="flex items-center gap-1.5 bg-[#09131d] hover:bg-[#0d1c2b] border border-[#223a54] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                  Saldo:
                </span>
                {hasDivZeroError ? (
                  <span className="font-mono text-xs font-black text-rose-400">Erro (/0)</span>
                ) : (
                  <span
                    className={`font-mono text-xs font-black tabular-nums ${
                      currentRunning < 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {currentRunning < 0 ? "-" : ""}R$ {formatTapeNumber(Math.abs(currentRunning))}
                  </span>
                )}
                {copiedId === "live_subtotal" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500" />
                )}
              </button>
            </div>

            {/* CalcTape-Style Bottom Status Bar */}
            <div className="bg-[#0b1520] border-t border-[#182c42] px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-[#152538] text-slate-200 px-2 py-0.5 rounded-full border border-[#223952]">
                  {zoomPct}%
                </span>
                <span className="bg-[#152538] text-slate-200 px-2 py-0.5 rounded-full border border-[#223952]">
                  Lin {activeLineNumber}:{evaluated.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sky-400 font-sans">
                <Check className="w-3 h-3" />
                <span>{statusFeedback || "Salvo automaticamente"}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
