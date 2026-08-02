/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import {
  User,
  Settings,
  LockOpen,
  CheckCircle,
  PlusCircle,
  MinusCircle,
  Clock,
  ShoppingCart,
  BarChart3,
  History,
  Printer,
  Pencil,
  Trash2,
  Lock,
  DollarSign,
  Briefcase,
  LayoutDashboard,
  Wallet,
  Receipt,
  Zap,
  Info,
  ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import {
  ShiftType,
  LancamentoType,
  Lancamento,
  Venda,
  DadosManuais,
  Fechamento,
  LocalDB,
  CaixaTurno
} from "./types";

import { doc, getDocFromServer, onSnapshot, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";

import ModalVenda from "./components/ModalVenda";
import ModalLancamento from "./components/ModalLancamento";
import ModalConsolidado from "./components/ModalConsolidado";
import ModalListaPendentes from "./components/ModalListaPendentes";
import ModalAbrirCaixa from "./components/ModalAbrirCaixa";
import ModalFecharCaixa from "./components/ModalFecharCaixa";
import ModalHistoricoFechamentos from "./components/ModalHistoricoFechamentos";
import PrintAreaElement from "./components/PrintAreaElement";

export default function App() {
  // --- Standard UI and Config State ---
  const [loja, setLoja] = useState<string>("Loja Matriz");
  const [operador, setOperador] = useState<string>("Operador");
  const [novaLoja, setNovaLoja] = useState<string>("");
  const [novoOperador, setNovoOperador] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [turno, setTurno] = useState<ShiftType>("Dia");
  const [saldoFinalInput, setSaldoFinalInput] = useState<string>("");

  // --- Core Cache Database (LocalDB definition) ---
  const [localDB, setLocalDB] = useState<LocalDB>({
    vendas: [],
    lancamentos: [],
    dadosManuais: {},
    historicoFechamentos: []
  });

  // --- Current Active Session State ---
  const [caixaTurno, setCaixaTurno] = useState<CaixaTurno>({
    lancamentos: [],
    vendas: [],
    saldoInicial: 0,
    aberto: false
  });

  // --- Modal Visibility State ---
  const [isVendaOpen, setIsVendaOpen] = useState(false);
  const [isLancamentoOpen, setIsLancamentoOpen] = useState(false);
  const [isConsolidadoOpen, setIsConsolidadoOpen] = useState(false);
  const [isListaPendentesOpen, setIsListaPendentesOpen] = useState(false);
  const [isAbrirCaixaOpen, setIsAbrirCaixaOpen] = useState(false);
  const [isFecharCaixaOpen, setIsFecharCaixaOpen] = useState(false);
  const [isHistoricoFechamentosOpen, setIsHistoricoFechamentosOpen] = useState(false);
  const [lancamentoTipo, setLancamentoTipo] = useState<LancamentoType | null>(null);
  const [lancamentoToEdit, setLancamentoToEdit] = useState<Lancamento | null>(null);
  const [vendaToEdit, setVendaToEdit] = useState<Venda | null>(null);

  // --- Printing Trigger State ---
  const [printType, setPrintType] = useState<"fechamento" | "item" | "consolidado" | "recebimento" | "lista_pendentes" | null>(null);
  const [printItem, setPrintItem] = useState<Lancamento | null>(null);
  const [printFechamento, setPrintFechamento] = useState<Fechamento | null>(null);
  const [printConsolidado, setPrintConsolidado] = useState<any | null>(null);
  const [printRecebimento, setPrintRecebimento] = useState<{
    cliente: string;
    valorPago: number;
    saldoDevedorAnterior: number;
    saldoDevedorAtual: number;
    loja: string;
    dataHora: string;
  } | null>(null);
  const [printListaPendentes, setPrintListaPendentes] = useState<{
    loja: string;
    devedores: { cliente: string; saldoDevedor: number }[];
    totalPendentes: number;
    dataHora: string;
  } | null>(null);

  // --- Settings View State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Local Print Server State ---
  const [isLocalPrintEnabled, setIsLocalPrintEnabled] = useState<boolean>(() => {
    return localStorage.getItem("is_local_print_enabled") === "true";
  });
  const [localPrintServerUrl, setLocalPrintServerUrl] = useState<string>(() => {
    return localStorage.getItem("local_print_server_url") || "http://localhost:3010";
  });
  const [printServerStatus, setPrintServerStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    return localStorage.getItem("selected_printer") || "";
  });
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [needsUpdateLocalServer, setNeedsUpdateLocalServer] = useState<boolean>(false);

  // --- Welcome Screen Selection Modal ---
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(true);

  // Fetch printers from local print server
  const fetchAvailablePrinters = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || localPrintServerUrl;
    try {
      const res = await fetch(`${targetUrl}/printers`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.printers)) {
          setAvailablePrinters(data.printers);
          setNeedsUpdateLocalServer(false);
        }
      } else if (res.status === 404) {
        setNeedsUpdateLocalServer(true);
        setAvailablePrinters([]);
      } else {
        setNeedsUpdateLocalServer(false);
      }
    } catch (err) {
      // Usamos console.warn em vez de console.error para não disparar alertas de falha de execução no monitor do applet
      console.warn("Servidor de impressoras offline ou inacessível no momento.");
    }
  };

  // Test printer server connection
  const testPrintServerConnection = async (urlToTest?: string) => {
    const targetUrl = urlToTest || localPrintServerUrl;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${targetUrl}/health`, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setPrintServerStatus("connected");
        fetchAvailablePrinters(targetUrl);
      } else {
        setPrintServerStatus("disconnected");
        setAvailablePrinters([]);
        setNeedsUpdateLocalServer(false);
      }
    } catch {
      setPrintServerStatus("disconnected");
      setAvailablePrinters([]);
      setNeedsUpdateLocalServer(false);
    }
  };

  const tryLocalPrint = async (htmlToPrint: string) => {
    if (!isLocalPrintEnabled) return false;
    try {
      const response = await fetch(`${localPrintServerUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          html: htmlToPrint,
          printerName: selectedPrinter || undefined
        })
      });
      const data = await response.json();
      return !!data.success;
    } catch (err) {
      console.warn("Falha ao enviar impressão silenciosa ao servidor local:", err);
      return false;
    }
  };

  // Initialize dates, test Firestore connection and register real-time listeners on mount
  useEffect(() => {
    const hoje = new Date().toISOString().split("T")[0];
    setData(hoje);

    // Load Local DB from LocalStorage
    const savedDB = localStorage.getItem("caixa_local_db");
    let dbParsed: LocalDB = {
      vendas: [],
      lancamentos: [],
      dadosManuais: {},
      historicoFechamentos: [],
      lojas: ["Loja Matriz", "Filial Centro", "Filial Shopping"],
      operadores: ["Operador", "Gerente", "Operador Noite"]
    };

    if (savedDB) {
      try {
        const parsed = JSON.parse(savedDB);
        dbParsed = {
          ...dbParsed,
          ...parsed,
          lojas: parsed.lojas && parsed.lojas.length > 0 ? parsed.lojas : dbParsed.lojas,
          operadores: parsed.operadores && parsed.operadores.length > 0 ? parsed.operadores : dbParsed.operadores
        };
      } catch (err) {
        console.error("Erro ao carregar banco local do localStorage", err);
      }
    }

    setLocalDB(dbParsed);
    localStorage.setItem("caixa_local_db", JSON.stringify(dbParsed));

    if (dbParsed.lojas && dbParsed.lojas.length > 0) {
      setLoja(dbParsed.lojas[0]);
    }
    if (dbParsed.operadores && dbParsed.operadores.length > 0) {
      setOperador(dbParsed.operadores[0]);
    }

    // Check Firebase connection
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("the client is offline")) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    }
    testConnection();
    testPrintServerConnection();

    // Subscribe to/observe global DB in Firestore
    const unsubLocalDB = onSnapshot(
      doc(db, "db_global", "local_db"),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteDB = docSnap.data() as LocalDB;
          setLocalDB(remoteDB);
          localStorage.setItem("caixa_local_db", JSON.stringify(remoteDB));
        } else {
          // Push initial defaults to newly created Firestore DB
          setDoc(doc(db, "db_global", "local_db"), dbParsed).catch((error) => {
            handleFirestoreError(error, OperationType.WRITE, "db_global/local_db");
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "db_global/local_db");
      }
    );

    return () => {
      unsubLocalDB();
    };
  }, []);

  // Sync Shift Session with Firestore and LocalStorage
  useEffect(() => {
    if (!data || !loja || !turno) return;

    const docId = `${loja}_${data}_${turno}`;

    const unsubSession = onSnapshot(
      doc(db, "caixa_session", docId),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteSession = docSnap.data() as CaixaTurno;
          setCaixaTurno(remoteSession);
          localStorage.setItem(`caixa_session_${loja}_${data}_${turno}`, JSON.stringify(remoteSession));
        } else {
          // If no remote session, try local storage
          const sessionKey = `caixa_session_${loja}_${data}_${turno}`;
          const savedSession = localStorage.getItem(sessionKey);
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession) as CaixaTurno;
              setCaixaTurno(parsed);
              setDoc(doc(db, "caixa_session", docId), parsed).catch((error) => {
                handleFirestoreError(error, OperationType.WRITE, `caixa_session/${docId}`);
              });
            } catch (err) {
              console.error("Erro ao carregar sessão caixa", err);
            }
          } else {
            // Lazy initialize a completely new session
            const emptySession: CaixaTurno = {
              lancamentos: [],
              vendas: [],
              saldoInicial: 0,
              aberto: false
            };
            setCaixaTurno(emptySession);
            setSaldoFinalInput("");
            localStorage.setItem(sessionKey, JSON.stringify(emptySession));
            setDoc(doc(db, "caixa_session", docId), emptySession).catch((error) => {
              handleFirestoreError(error, OperationType.WRITE, `caixa_session/${docId}`);
            });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `caixa_session/${docId}`);
      }
    );

    return () => {
      unsubSession();
    };
  }, [loja, data, turno]);

  // Persist LocalDB changes to LocalStorage and Firestore
  const saveLocalDBToStorage = async (newDB: LocalDB) => {
    setLocalDB(newDB);
    localStorage.setItem("caixa_local_db", JSON.stringify(newDB));
    try {
      await setDoc(doc(db, "db_global", "local_db"), newDB);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "db_global/local_db");
    }
  };

  // Persist current session changes to LocalStorage and Firestore
  const saveSessionToStorage = async (newSession: CaixaTurno) => {
    setCaixaTurno(newSession);
    const sessionKey = `caixa_session_${loja}_${data}_${turno}`;
    localStorage.setItem(sessionKey, JSON.stringify(newSession));
    try {
      const docId = `${loja}_${data}_${turno}`;
      await setDoc(doc(db, "caixa_session", docId), newSession);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `caixa_session/${loja}_${data}_${turno}`);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ignore if user is inside form elements so they don't trigger actions when typing
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case "v":
          e.preventDefault();
          if (caixaTurno.aberto) {
            const existingVenda = (caixaTurno.vendas || []).find((v) => v.turno === turno);
            setVendaToEdit(existingVenda || null);
            setIsVendaOpen(true);
          }
          break;
        case "e":
          e.preventDefault();
          if (caixaTurno.aberto) {
            setLancamentoTipo("entrada");
            setLancamentoToEdit(null);
            setIsLancamentoOpen(true);
          }
          break;
        case "s":
          e.preventDefault();
          if (caixaTurno.aberto) {
            setLancamentoTipo("saida");
            setLancamentoToEdit(null);
            setIsLancamentoOpen(true);
          }
          break;
        case "p":
          e.preventDefault();
          if (caixaTurno.aberto) {
            setLancamentoTipo("pendente");
            setLancamentoToEdit(null);
            setIsLancamentoOpen(true);
          }
          break;
        case "l":
          e.preventDefault();
          setIsListaPendentesOpen(true);
          break;
        case "h":
          e.preventDefault();
          setIsHistoricoFechamentosOpen(true);
          break;
        case "f":
          e.preventDefault();
          setIsConsolidadoOpen(true);
          break;
        case "c":
          e.preventDefault();
          if (!caixaTurno.aberto) {
            setIsAbrirCaixaOpen(true);
          } else {
            setIsFecharCaixaOpen(true);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [caixaTurno.aberto, caixaTurno.vendas, turno]);

  // --- Math Calculations for the Dashboard Metrics ---
  const fTurno = (item: { turno: ShiftType }) => item.turno === turno;

  const entradasSum = (caixaTurno?.lancamentos || [])
    .filter((l) => l && l.tipo === "entrada" && fTurno(l))
    .reduce((sum, l) => sum + (l.valor || 0), 0);

  const saidasSum = (caixaTurno?.lancamentos || [])
    .filter((l) => l && l.tipo === "saida" && fTurno(l))
    .reduce((sum, l) => sum + (l.valor || 0), 0);

  const pendentesSum = (caixaTurno?.lancamentos || [])
    .filter((l) => l && l.tipo === "pendente" && fTurno(l))
    .reduce((sum, l) => sum + (l.valor || 0), 0);

  const totalItensVenda = (caixaTurno?.vendas || [])
    .filter((v) => v && fTurno(v))
    .reduce((sum, v) => sum + (v.itens || 0), 0);

  const totalServicoVenda = (caixaTurno?.vendas || [])
    .filter((v) => v && fTurno(v))
    .reduce((sum, v) => sum + (v.servico || 0), 0);

  const sFin = parseFloat(saldoFinalInput.replace(",", ".")) || 0;

  // Ledger Volume Formula: (Entradas + Saidas + Pendentes + Gaveta Final) - Saldo Inicial
  const volumeLiquido = (entradasSum + saidasSum + pendentesSum + sFin) - (caixaTurno?.saldoInicial ?? 0);
  const diferencaTerminal = volumeLiquido - totalItensVenda;

  // --- Handlers & Actions ---

  // Trigger cash drawer OPENING
  const handleAbrirCaixaConfirm = (initialBal: number) => {
    const newSession: CaixaTurno = {
      lancamentos: [],
      vendas: [],
      saldoInicial: initialBal,
      aberto: true
    };
    saveSessionToStorage(newSession);
    setSaldoFinalInput("");
  };

  // Reopen any previously closed session
  const handleReabrirQualquerCaixa = async (fechamento: Fechamento) => {
    if (
      !confirm(
        `Deseja realmente reabrir o caixa fechado de ${fechamento.loja} (${fechamento.dataHora})?`
      )
    ) {
      return;
    }

    // 1. Update the active store, operator, date, and shift parameters
    setLoja(fechamento.loja);
    setOperador(fechamento.operador);
    setData(fechamento.data);
    setTurno(fechamento.turno);

    // 2. Prepare the reopened session
    const reabertoCaixa: CaixaTurno = {
      lancamentos: fechamento.lancamentos || [],
      vendas: fechamento.vendas || [],
      saldoInicial: fechamento.saldoInicial,
      aberto: true
    };

    // 3. Persist shift session back to open state in local and remote DBs
    const targetSessionKey = `caixa_session_${fechamento.loja}_${fechamento.data}_${fechamento.turno}`;
    localStorage.setItem(targetSessionKey, JSON.stringify(reabertoCaixa));
    setCaixaTurno(reabertoCaixa);

    try {
      const docId = `${fechamento.loja}_${fechamento.data}_${fechamento.turno}`;
      await setDoc(doc(db, "caixa_session", docId), reabertoCaixa);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `caixa_session/${fechamento.loja}_${fechamento.data}_${fechamento.turno}`);
    }

    // 4. Remove this specific closing entry from historicoFechamentos
    const historico = localDB.historicoFechamentos || [];
    const novoHistorico = historico.filter((h) => h.id !== fechamento.id);
    saveLocalDBToStorage({ ...localDB, historicoFechamentos: novoHistorico });

    // 5. Dismiss the history modal
    setIsHistoricoFechamentosOpen(false);
  };

  // Commit Sale Log
  const handleSaveVenda = (servico: number, itens: number, editId: number | null) => {
    if (editId) {
      // --- UPDATE EXISTING SALE ---
      const updatedVendas = localDB.vendas.map((v) =>
        v.id === editId ? { ...v, servico, itens } : v
      );
      saveLocalDBToStorage({ ...localDB, vendas: updatedVendas });

      const updatedSessionVendas = (caixaTurno.vendas || []).map((v) =>
        v.id === editId ? { ...v, servico, itens } : v
      );
      saveSessionToStorage({ ...caixaTurno, vendas: updatedSessionVendas });
    } else {
      // --- CREATE NEW SALE ---
      const newVenda: Venda = {
        id: Date.now(),
        servico,
        itens,
        turno,
        data,
        loja
      };

      // Add to LocalDB list
      const updatedVendas = [...localDB.vendas, newVenda];
      saveLocalDBToStorage({ ...localDB, vendas: updatedVendas });

      // Add to current session list
      const updatedSessionVendas = [...caixaTurno.vendas, newVenda];
      saveSessionToStorage({ ...caixaTurno, vendas: updatedSessionVendas });
    }
  };

  const handleExcluirVenda = (id: number) => {
    const updatedVendas = localDB.vendas.filter((v) => v.id !== id);
    saveLocalDBToStorage({ ...localDB, vendas: updatedVendas });

    const updatedSessionVendas = (caixaTurno.vendas || []).filter((v) => v.id !== id);
    saveSessionToStorage({ ...caixaTurno, vendas: updatedSessionVendas });
  };

  // Commit General Entry (Create/Update)
  const handleSaveLancamento = (
    id: number | null,
    descricao: string,
    valor: number,
    tipo: LancamentoType
  ) => {
    if (id) {
      // --- UPDATE EXISTING ENTRY ---
      // Update in LocalDB
      const updatedLancamentos = localDB.lancamentos.map((l) =>
        l.id === id ? { ...l, descricao, valor, tipo } : l
      );
      saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });

      // Update in active session
      const updatedSessionLancamentos = caixaTurno.lancamentos.map((l) =>
        l.id === id ? { ...l, descricao, valor, tipo } : l
      );
      saveSessionToStorage({ ...caixaTurno, lancamentos: updatedSessionLancamentos });
    } else {
      // --- CREATE NEW ENTRY ---
      const newLancamento: Lancamento = {
        id: Date.now(),
        valor,
        descricao,
        tipo,
        turno,
        data,
        loja
      };

      const updatedLancamentos = [...localDB.lancamentos, newLancamento];
      saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });

      const updatedSessionLancamentos = [...caixaTurno.lancamentos, newLancamento];
      saveSessionToStorage({ ...caixaTurno, lancamentos: updatedSessionLancamentos });
    }
    setLancamentoToEdit(null);
  };

  // Delete Entry Row
  const handleExcluirLancamento = (id: number) => {
    if (!confirm("Tem certeza de que deseja excluir este lançamento?")) return;

    const updatedLancamentos = localDB.lancamentos.filter((l) => l.id !== id);
    saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });

    const updatedSessionLancamentos = caixaTurno.lancamentos.filter((l) => l.id !== id);
    saveSessionToStorage({ ...caixaTurno, lancamentos: updatedSessionLancamentos });
  };

  // Edit Entry Trigger
  const handleEditLancamento = (item: Lancamento) => {
    setLancamentoToEdit(item);
    setLancamentoTipo(item.tipo);
    setIsLancamentoOpen(true);
  };

  // Trigger Cashier shift CLOSING and print closing receipt
  const handleFecharCaixaConfirm = () => {
    // Highly resilient filtering with case-insensitivity and full array fallback
    let currentShiftLancamentos = (caixaTurno.lancamentos || []).filter(
      (l) => l && String(l.turno).toLowerCase() === String(turno).toLowerCase()
    );
    if (currentShiftLancamentos.length === 0 && (caixaTurno.lancamentos || []).length > 0) {
      currentShiftLancamentos = caixaTurno.lancamentos;
    }

    let currentShiftVendas = (caixaTurno.vendas || []).filter(
      (v) => v && String(v.turno).toLowerCase() === String(turno).toLowerCase()
    );
    if (currentShiftVendas.length === 0 && (caixaTurno.vendas || []).length > 0) {
      currentShiftVendas = caixaTurno.vendas;
    }

    const dadosFechamento: Fechamento = {
      id: Date.now(),
      loja,
      operador,
      data,
      turno,
      saldoInicial: caixaTurno.saldoInicial,
      saldoFinal: sFin,
      lancamentos: currentShiftLancamentos,
      vendas: currentShiftVendas,
      dataHora: new Date().toLocaleString("pt-BR")
    };

    // Save report in historical logs
    const updatedFechamentos = [...(localDB.historicoFechamentos || []), dadosFechamento];
    saveLocalDBToStorage({ ...localDB, historicoFechamentos: updatedFechamentos });

    // Close session state inside storage
    const closedSession = { ...caixaTurno, aberto: false };
    saveSessionToStorage(closedSession);

    // Call Print Engine
    triggerMockPrint("fechamento", null, dadosFechamento, null);
  };

  const handleReimprimirHistoricoDirect = (fechamento: Fechamento) => {
    triggerMockPrint("fechamento", null, fechamento, null);
  };

  // Commit manual consolidated values inside ModalConsolidado
  const handleSaveDadosManuais = (
    chosenLoja: string,
    chosenData: string,
    values: { delivery: number; taxaEntrega: number; couvert: number; descDelivery: number }
  ) => {
    const key = `${chosenLoja}_${chosenData}`;
    const newDadosManuais = { ...localDB.dadosManuais, [key]: values };
    saveLocalDBToStorage({ ...localDB, dadosManuais: newDadosManuais });
  };

  // Print voucher item receipt
  const handlePrintItemComprovante = (item: Lancamento) => {
    triggerMockPrint("item", item, null, null);
  };

  // Internal print triggers
  const triggerMockPrint = (
    type: "fechamento" | "item" | "consolidado" | "recebimento",
    item: Lancamento | null,
    fechamento: Fechamento | null,
    consolidado: any | null,
    recebimento: any | null = null
  ) => {
    setPrintType(type);
    setPrintItem(item);
    setPrintFechamento(fechamento);
    setPrintConsolidado(consolidado);
    setPrintRecebimento(recebimento);

    // Trigger printing view
    setTimeout(async () => {
      let printedSilently = false;
      if (isLocalPrintEnabled) {
        const printAreaEl = document.getElementById("printArea");
        if (printAreaEl) {
          printedSilently = await tryLocalPrint(printAreaEl.innerHTML);
        }
      }

      if (!printedSilently) {
        window.print();
      }

      // Restore state post-print asynchronously
      setTimeout(() => {
        setPrintType(null);
        setPrintItem(null);
        setPrintFechamento(null);
        setPrintConsolidated(null);
        setPrintRecebimento(null);
      }, 500);
    }, 250);
  };

  const setPrintConsolidated = (val: any) => {
    setPrintConsolidado(val);
  };

  const handleSavePaymentPendente = (
    cliente: string,
    valorPago: number,
    updatedLancamentos: Lancamento[],
    tipoRegistroCaixa: "entrada" | "saida" | "nenhum"
  ) => {
    if (tipoRegistroCaixa !== "nenhum" && caixaTurno.aberto) {
      const newLancamento: Lancamento = {
        id: Date.now(),
        valor: tipoRegistroCaixa === 'saida' ? -Math.abs(valorPago) : Math.abs(valorPago),
        descricao: `Receb. Pendente: ${cliente}`,
        tipo: 'saida', // Always register under 'saida' as requested
        turno: turno,
        data: data,
        loja: loja
      };

      // Append entry to database
      const finalLancamentos = [...updatedLancamentos, newLancamento];
      saveLocalDBToStorage({ ...localDB, lancamentos: finalLancamentos });

      // Append entry to current active cashier session
      const finalSessionLancamentos = [...caixaTurno.lancamentos, newLancamento];
      saveSessionToStorage({ ...caixaTurno, lancamentos: finalSessionLancamentos });
    } else {
      // Just save the updated pending lists to DB
      saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });

      // Also sync back to active session if any changed pendente was in the active session
      const updatedSessionLancamentos = (caixaTurno.lancamentos || []).map((item) => {
        const found = updatedLancamentos.find((x) => x.id === item.id);
        return found ? found : item;
      });
      saveSessionToStorage({ ...caixaTurno, lancamentos: updatedSessionLancamentos });
    }
  };

  const handleUpdateLancamentosDirect = (updatedLancamentos: Lancamento[]) => {
    saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });

    // Sync any edits back to the active session if they were originally part of it
    const updatedSessionLancamentos = (caixaTurno.lancamentos || []).map((item) => {
      const found = updatedLancamentos.find((x) => x.id === item.id);
      return found ? found : item;
    });
    saveSessionToStorage({ ...caixaTurno, lancamentos: updatedSessionLancamentos });
  };

  const handlePrintPaymentReceipt = (
    cliente: string,
    valorPago: number,
    saldoDevedorAnterior: number,
    saldoDevedorAtual: number,
    lojaNome: string
  ) => {
    const receiptData = {
      cliente,
      valorPago,
      saldoDevedorAnterior,
      saldoDevedorAtual,
      loja: lojaNome,
      dataHora: `${data.split("-").reverse().join("/")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    };
    triggerMockPrint("recebimento", null, null, null, receiptData);
  };

  const handlePrintListaPendentes = (
    lojaNome: string,
    devedores: { cliente: string; saldoDevedor: number }[],
    totalPendentes: number
  ) => {
    setPrintType("lista_pendentes");
    setPrintListaPendentes({
      loja: lojaNome,
      devedores,
      totalPendentes,
      dataHora: `${data.split("-").reverse().join("/")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    });

    setTimeout(async () => {
      let printedSilently = false;
      if (isLocalPrintEnabled) {
        const printAreaEl = document.getElementById("printArea");
        if (printAreaEl) {
          printedSilently = await tryLocalPrint(printAreaEl.innerHTML);
        }
      }

      if (!printedSilently) {
        window.print();
      }

      setTimeout(() => {
        setPrintType(null);
        setPrintListaPendentes(null);
      }, 500);
    }, 250);
  };

  const handleAddLancamentoPendenteDirect = (
    descricao: string,
    valor: number,
    lojaNome: string
  ) => {
    const newLancamento: Lancamento = {
      id: Date.now(),
      valor,
      descricao: descricao.trim(),
      tipo: "pendente",
      turno,
      data,
      loja: lojaNome
    };

    const updatedLancamentos = [...localDB.lancamentos, newLancamento];
    saveLocalDBToStorage({ ...localDB, lancamentos: updatedLancamentos });
  };

  // Add new Store
  const handleAddLoja = (e: FormEvent) => {
    e.preventDefault();
    const clean = novaLoja.trim();
    if (!clean) return;

    const currentLojas = localDB.lojas || [];
    if (currentLojas.map(l => l.toLowerCase()).includes(clean.toLowerCase())) {
      alert("Esta loja já está cadastrada!");
      return;
    }

    const updatedLojas = [...currentLojas, clean];
    const updatedDB = { ...localDB, lojas: updatedLojas };
    saveLocalDBToStorage(updatedDB);
    setNovaLoja("");
    // Automatically select the new store if it is the only one (or just a nice flow)
    if (currentLojas.length === 0) {
      setLoja(clean);
    }
  };

  // Remove Store
  const handleRemoveLoja = (lojaToRemove: string) => {
    const currentLojas = localDB.lojas || [];
    if (currentLojas.length <= 1) {
      alert("Você precisa manter pelo menos uma loja cadastrada!");
      return;
    }
    if (!confirm(`Deseja realmente remover a loja "${lojaToRemove}"?`)) return;

    const updatedLojas = currentLojas.filter((l) => l !== lojaToRemove);
    const updatedDB = { ...localDB, lojas: updatedLojas };
    saveLocalDBToStorage(updatedDB);
    
    // If the active store is the removed one, switch to the first available
    if (loja === lojaToRemove) {
      setLoja(updatedLojas[0]);
    }
  };

  // Add new Operator
  const handleAddOperador = (e: FormEvent) => {
    e.preventDefault();
    const clean = novoOperador.trim();
    if (!clean) return;

    const currentOperadores = localDB.operadores || [];
    if (currentOperadores.map(o => o.toLowerCase()).includes(clean.toLowerCase())) {
      alert("Este funcionário já está cadastrado!");
      return;
    }

    const updatedOperadores = [...currentOperadores, clean];
    const updatedDB = { ...localDB, operadores: updatedOperadores };
    saveLocalDBToStorage(updatedDB);
    setNovoOperador("");
    if (currentOperadores.length === 0) {
      setOperador(clean);
    }
  };

  // Remove Operator
  const handleRemoveOperador = (opToRemove: string) => {
    const currentOperadores = localDB.operadores || [];
    if (currentOperadores.length <= 1) {
      alert("Você precisa manter pelo menos um funcionário cadastrado!");
      return;
    }
    if (!confirm(`Deseja realmente remover o funcionário "${opToRemove}"?`)) return;

    const updatedOperadores = currentOperadores.filter((o) => o !== opToRemove);
    const updatedDB = { ...localDB, operadores: updatedOperadores };
    saveLocalDBToStorage(updatedDB);

    // If active operator is removed, switch to the first available
    if (operador === opToRemove) {
      setOperador(updatedOperadores[0]);
    }
  };

  return (
    <>
      <div className="bg-background text-on-background font-body-md min-h-screen pb-16 no-print flex flex-col">
        
        {/* Top Navbar Header */}
        <header className="bg-white border-b-4 border-secondary shadow-md sticky top-0 z-40 transition-soft">
          <div className="flex justify-between items-center px-4 md:px-6 w-full max-w-container-max mx-auto h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white shadow-inner">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-sans text-md md:text-lg font-black tracking-tight text-primary flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-secondary" /> Terminal de Caixa
                </h1>
                <p className="font-mono text-[9px] uppercase font-bold text-outline tracking-wider">
                  CASHIER DESK OPERATOR
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`text-outline hover:text-secondary hover:bg-surface-container-low transition-soft p-2 rounded-xl cursor-pointer ${isSettingsOpen ? "bg-surface-container-low text-secondary" : ""}`}
                title="Configurações da Loja"
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-container-max mx-auto px-4 py-6 space-y-6">
          
          {/* Collapse Store Settings Panel */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-primary-container text-white p-5 rounded-2xl shadow-xl space-y-4 overflow-hidden border border-outline-variant/25"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <h3 className="font-sans text-xs font-black uppercase tracking-wider flex items-center gap-2 text-tertiary-fixed-dim">
                    <Settings className="w-4 h-4" /> Configurações Gerais - Cadastro
                  </h3>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-white/60 hover:text-white transition-soft font-mono text-xs cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Column 1: Lojas */}
                  <div className="md:col-span-5 space-y-2">
                    <label className="font-mono text-[9px] font-bold text-on-primary-container block uppercase tracking-wider">
                      GESTÃO DE LOJAS
                    </label>
                    <form onSubmit={handleAddLoja} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nome da Loja..."
                        className="flex-1 bg-slate-900 border border-slate-700/60 p-2 h-9 text-xs rounded-xl outline-none font-medium text-white focus:border-brand-highlight"
                        value={novaLoja}
                        onChange={(e) => setNovaLoja(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="bg-secondary hover:bg-opacity-80 w-9 h-9 rounded-xl font-bold font-sans text-xs flex items-center justify-center shrink-0 cursor-pointer text-white transition-soft"
                        title="Adicionar Loja"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </form>
                    
                    <div className="max-h-40 overflow-y-auto bg-slate-950/40 border border-slate-800/85 rounded-xl p-2.5 space-y-1">
                      {(!localDB.lojas || localDB.lojas.length === 0) ? (
                        <p className="text-[10px] text-white/55 italic text-center py-4">Nenhuma loja cadastrada.</p>
                      ) : (
                        localDB.lojas.map((l, index) => (
                          <div key={index} className="flex justify-between items-center bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs transition-soft">
                            <span className="font-semibold text-white/95 truncate mr-2">{l}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLoja(l)}
                              className="text-rose-400 hover:text-error hover:bg-error-container/10 p-1 rounded transition-soft cursor-pointer shrink-0"
                              title="Excluir Loja"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: Funcionários */}
                  <div className="md:col-span-5 space-y-2">
                    <label className="font-mono text-[9px] font-bold text-on-primary-container block uppercase tracking-wider">
                      GESTÃO DE FUNCIONÁRIOS / OPERADORES
                    </label>
                    <form onSubmit={handleAddOperador} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nome do Operador..."
                        className="flex-1 bg-slate-900 border border-slate-700/60 p-2 h-9 text-xs rounded-xl outline-none font-medium text-white focus:border-secondary"
                        value={novoOperador}
                        onChange={(e) => setNovoOperador(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="bg-secondary hover:bg-opacity-80 w-9 h-9 rounded-xl font-bold font-sans text-xs flex items-center justify-center shrink-0 cursor-pointer text-white transition-soft"
                        title="Adicionar Funcionário"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </form>

                    <div className="max-h-40 overflow-y-auto bg-slate-950/40 border border-slate-800/85 rounded-xl p-2.5 space-y-1">
                      {(!localDB.operadores || localDB.operadores.length === 0) ? (
                        <p className="text-[10px] text-white/55 italic text-center py-4">Nenhum funcionário cadastrado.</p>
                      ) : (
                        localDB.operadores.map((op, index) => (
                          <div key={index} className="flex justify-between items-center bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs transition-soft">
                            <span className="font-semibold text-white/95 truncate mr-2">{op}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOperador(op)}
                              className="text-rose-400 hover:text-error hover:bg-error-container/10 p-1 rounded transition-soft cursor-pointer shrink-0"
                              title="Excluir Funcionário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 3: Informações */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="font-mono text-[9px] font-bold text-on-primary-container block uppercase tracking-wider">
                      INSTRUÇÕES
                    </label>
                    <div className="bg-slate-950/20 border border-slate-800 rounded-xl p-3 text-[11px] text-white/80 leading-relaxed space-y-1.5">
                      <p className="flex items-start gap-1">
                        <Info className="w-3.5 h-3.5 text-brand-highlight shrink-0 mt-0.5" />
                        Cadastre as lojas e funcionários.
                      </p>
                      <p>
                        Depois selecione a loja e o operador ativos na tela inicial do seu caixa.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Printing Server Configuration Section */}
                <div className="border-t border-white/10 pt-4 mt-4 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  <div className="md:col-span-12">
                    <h4 className="font-sans text-xs font-black uppercase tracking-wider flex items-center gap-2 text-amber-400 mb-1">
                      <Printer className="w-4 h-4" /> Servidor de Impressão Silenciosa (Node.js)
                    </h4>
                  </div>

                  <div className="md:col-span-4 space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800/80 p-3 rounded-xl">
                      <div>
                        <span className="text-xs font-bold block text-white">Ativar Impressão Direta</span>
                        <span className="text-[10px] text-white/50 block">Imprime sem abrir janela do Chrome</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = !isLocalPrintEnabled;
                          setIsLocalPrintEnabled(val);
                          localStorage.setItem("is_local_print_enabled", String(val));
                        }}
                        className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${
                          isLocalPrintEnabled ? "bg-amber-500" : "bg-slate-700"
                        }`}
                      >
                        <div
                          className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                            isLocalPrintEnabled ? "translate-x-5.5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] font-bold text-on-primary-container block uppercase tracking-wider">
                        URL DO SERVIDOR LOCAL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 bg-slate-900 border border-slate-700/60 p-2 h-9 text-xs rounded-xl outline-none font-mono text-white focus:border-brand-highlight"
                          placeholder="Ex: http://localhost:3010"
                          value={localPrintServerUrl}
                          onChange={(e) => {
                            setLocalPrintServerUrl(e.target.value);
                            localStorage.setItem("local_print_server_url", e.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => testPrintServerConnection(localPrintServerUrl)}
                          className="bg-secondary hover:bg-opacity-80 px-3 h-9 rounded-xl font-black font-sans text-[10px] uppercase cursor-pointer text-white transition-soft"
                        >
                          Testar
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/60">Status:</span>
                      {printServerStatus === "connected" ? (
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] uppercase">Conectado</span>
                      ) : printServerStatus === "disconnected" ? (
                        <span className="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-full text-[10px] uppercase">Não Detectado</span>
                      ) : (
                        <span className="text-white/40 font-bold bg-white/5 px-2.5 py-1 rounded-full text-[10px] uppercase">Não Testado</span>
                      )}
                    </div>

                    <div className="space-y-3 pt-1.5 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                          SELECIONAR IMPRESSORA TÉRMICA
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            fetchAvailablePrinters(localPrintServerUrl);
                          }}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-sans"
                        >
                          🔄 Atualizar Lista
                        </button>
                      </div>

                      {needsUpdateLocalServer ? (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300 leading-relaxed space-y-1.5 font-sans">
                          <p className="font-bold">🚨 Atualize o Script do Servidor no seu PC!</p>
                          <p>
                            Seu servidor local está rodando uma <strong>versão antiga</strong> que não possui o recurso de listar impressoras.
                          </p>
                          <p className="text-white/80">
                            <strong>Como corrigir:</strong>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-300">
                            <li>Pare o servidor atual apertando <kbd className="bg-slate-950 px-1 py-0.5 rounded text-[10px] text-rose-400 font-mono">Ctrl + C</kbd> no seu terminal/prompt.</li>
                            <li>Copie o novo script <code className="bg-slate-950 px-1 py-0.5 text-amber-400 font-mono">local-print-server.js</code> do seu projeto (veja as instruções ao lado).</li>
                            <li>Inicie o servidor de novo: <code className="bg-slate-950 px-1.5 py-0.5 text-emerald-400 font-mono">node local-print-server.js</code>.</li>
                          </ol>
                        </div>
                      ) : availablePrinters.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            className="w-full bg-slate-900 border border-slate-700/60 p-2 h-9 text-xs rounded-xl outline-none font-sans text-white focus:border-amber-500"
                            value={selectedPrinter}
                            onChange={(e) => {
                              setSelectedPrinter(e.target.value);
                              localStorage.setItem("selected_printer", e.target.value);
                            }}
                          >
                            <option value="">-- Impressora Padrão do Sistema --</option>
                            {availablePrinters.map((printer) => (
                              <option key={printer} value={printer}>
                                🖨️ {printer}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                            Se a impressora que deseja usar está listada acima, selecione-a. Caso contrário, você pode digitar o nome dela no campo abaixo.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed space-y-1 font-sans">
                          <p className="font-bold text-amber-400">⚠️ Nenhuma impressora detectada automaticamente ainda.</p>
                          <p>Você pode digitar o nome exato dela no campo abaixo ou clicar em "Atualizar Lista" quando o servidor estiver rodando.</p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                          OU DIGITE O NOME EXATO DA IMPRESSORA:
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-900 border border-slate-700/60 p-2 h-9 text-xs rounded-xl outline-none font-mono text-white focus:border-amber-500"
                          placeholder="Ex: Bematech, EPSON TM-T20, POS-80"
                          value={selectedPrinter}
                          onChange={(e) => {
                            setSelectedPrinter(e.target.value);
                            localStorage.setItem("selected_printer", e.target.value);
                          }}
                        />
                        <p className="text-[10px] text-white/40 font-sans">
                          Salvo automaticamente: <span className="text-amber-400 font-mono">{selectedPrinter || "Nenhuma (Padrão do Sistema)"}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-8 bg-slate-950/40 border border-slate-800/85 rounded-xl p-4 md:p-5 space-y-4">
                    <h5 className="font-sans text-[11px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                      💡 CONFIGURAÇÃO DO SERVIDOR DE IMPRESSÃO TÉRMICA
                    </h5>
                    
                    {/* Opções de Download */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Opção 1: Executável Direto */}
                      <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[9px] font-mono font-bold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                            Método Fácil (Recomendado)
                          </span>
                          <h6 className="font-sans text-[12px] font-bold text-white mt-2 flex items-center gap-1.5">
                            ⚡ Servidor Pronto (Windows)
                          </h6>
                          <p className="text-[10px] text-white/60 leading-normal mt-1 font-sans">
                            Executável direto <code className="font-mono text-amber-400">.exe</code> de apenas um clique. Não precisa instalar o Node.js nem digitar comandos!
                          </p>
                        </div>
                        <a
                          href="/local-print-server.exe"
                          download="local-print-server.exe"
                          className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-center text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/5 cursor-pointer font-sans"
                        >
                          📥 Baixar Executável (Windows)
                        </a>
                      </div>

                      {/* Opção 2: Script Node.js */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[9px] font-mono font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                            Método Manual
                          </span>
                          <h6 className="font-sans text-[12px] font-bold text-white mt-2 flex items-center gap-1.5">
                            🛠️ Script Node.js
                          </h6>
                          <p className="text-[10px] text-white/60 leading-normal mt-1 font-sans">
                            Se preferir, use o script <code className="font-mono text-slate-300">.js</code> nativo e execute no seu terminal usando o Node.js.
                          </p>
                        </div>
                        <a
                          href="/local-print-server.js"
                          download="local-print-server.js"
                          className="w-full bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/60 text-slate-200 font-semibold text-center text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                        >
                          📄 Baixar Código (.js)
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <p className="text-[11px] font-bold text-white/90 font-sans">Como usar o servidor de impressão no seu PC:</p>
                      
                      {/* Passos de Configuração */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10.5px] text-white/70 font-sans leading-relaxed">
                        <div className="space-y-1.5">
                          <p className="font-semibold text-amber-400 flex items-center gap-1">
                            <span>1️⃣</span> Se usar o Executável (.exe):
                          </p>
                          <ul className="list-disc list-inside pl-1 space-y-1 text-white/60">
                            <li>Baixe e salve o <code className="text-white">local-print-server.exe</code> no seu computador.</li>
                            <li>Dê dois cliques para abrir. Uma janela preta do prompt abrirá indicando que o servidor está ativo.</li>
                            <li>Deixe-o rodando minimizado enquanto usa o sistema!</li>
                          </ul>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-slate-400 flex items-center gap-1">
                            <span>2️⃣</span> Se usar o Script (.js):
                          </p>
                          <ul className="list-disc list-inside pl-1 space-y-1 text-white/60">
                            <li>Instale o Node.js no seu computador.</li>
                            <li>Abra o terminal na pasta do arquivo e digite:</li>
                            <li className="list-none bg-slate-950 p-1.5 rounded font-mono text-[9px] text-emerald-300 mt-1 select-all">
                              npm install express cors<br/>
                              node local-print-server.js
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.section>
            )}
          </AnimatePresence>

          {/* Core Configuration Ledger Header Panel (Main view inputs) */}
          <section className="bg-primary-container text-white p-5 md:p-6 rounded-2xl shadow-lg grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end border border-slate-800 animate-fade-in">
            <div>
              <label className="font-mono text-[9px] font-bold text-on-primary-container mb-1.5 block uppercase tracking-wider">
                LOJA ATUAL
              </label>
              <select
                className="w-full bg-slate-950 border-b border-outline outline-none text-xs font-bold text-brand-highlight font-sans py-1.5 focus:border-white transition-soft cursor-pointer capitalize"
                value={loja}
                onChange={(e) => setLoja(e.target.value)}
              >
                {(localDB.lojas || []).map((l, index) => (
                  <option key={index} value={l} className="bg-slate-950 text-white">
                    🏪 {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[9px] font-bold text-on-primary-container mb-1.5 block uppercase tracking-wider">
                OPERADOR DE TURNO
              </label>
              <select
                className="w-full bg-slate-950 border-b border-outline outline-none text-xs font-bold text-white font-mono py-1.5 focus:border-white transition-soft cursor-pointer"
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
              >
                {(localDB.operadores || []).map((op, index) => (
                  <option key={index} value={op} className="bg-slate-950 text-white font-mono">
                    👤 {op}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[9px] font-bold text-on-primary-container mb-1.5 block uppercase tracking-wider">
                DATA REGISTRO
              </label>
              <input
                type="date"
                className="w-full bg-transparent border-b border-outline outline-none font-mono text-xs text-white uppercase py-1 focus:border-white transition-soft"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div>
              <label className="font-mono text-[9px] font-bold text-on-primary-container mb-1.5 block uppercase tracking-wider">
                TURNO OPERACIONAL
              </label>
              <select
                className="w-full bg-slate-950 border-b border-outline outline-none text-xs font-medium text-white font-sans py-1.5 focus:border-white transition-soft cursor-pointer"
                value={turno}
                onChange={(e) => setTurno(e.target.value as ShiftType)}
              >
                <option value="Dia">🌞 Turno Dia</option>
                <option value="Noite">🌚 Turno Noite</option>
              </select>
            </div>
          </section>

          {/* Shift Action Commands buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {!caixaTurno.aberto ? (
              <>
                <button
                  onClick={() => setIsAbrirCaixaOpen(true)}
                  className="flex-[2] bg-secondary hover:bg-blue-700 text-white font-sans font-black py-4.5 rounded-2xl uppercase tracking-wider text-sm shadow-md active:scale-95 duration-150 transition-soft flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <LockOpen className="w-5 h-5 text-white animate-pulse" /> Abrir Caixa / Inicializar Turno [C]
                </button>
                <button
                  onClick={() => setIsHistoricoFechamentosOpen(true)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans font-black py-4.5 rounded-2xl uppercase tracking-wider text-sm shadow-md active:scale-95 duration-150 transition-soft flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Clock className="w-5 h-5 text-amber-400" /> Reabrir Último Caixa
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsFecharCaixaOpen(true)}
                className="flex-1 bg-error hover:bg-rose-700 text-white font-sans font-black py-4.5 rounded-2xl uppercase tracking-wider text-sm shadow-md active:scale-95 duration-150 transition-soft flex items-center justify-center gap-2.5 cursor-pointer animate-fade-in"
              >
                <CheckCircle className="w-5 h-5 text-white" /> Encerrar Turno &amp; Imprimir Comprovante [C]
              </button>
            )}
          </div>

          {/* Performance Dashboard Bento Grid Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* VOL. LÍQUIDO */}
            <div
              onClick={() => {
                if (caixaTurno.aberto) setIsConsolidadoOpen(true);
              }}
              className="bg-white p-4.5 rounded-2xl shadow border-t-4 border-secondary-container hover:shadow-lg transition-soft cursor-pointer group"
            >
              <label className="font-mono text-[10px] text-outline uppercase font-bold tracking-wider italic flex justify-between items-center">
                VOL. LÍQUIDO
                <span className="text-[9px] text-outline-variant font-normal group-hover:text-secondary opacity-0 group-hover:opacity-100 transition-soft">
                  Ver Relatório →
                </span>
              </label>
              <div className="font-mono text-2xl font-black text-secondary-container tracking-tight mt-1">
                R$ {volumeLiquido.toFixed(2)}
              </div>
            </div>

            {/* VENDA ITENS */}
            <div className="bg-white p-4.5 rounded-2xl shadow border-t-4 border-status-sales">
              <label className="font-mono text-[10px] text-outline uppercase font-bold tracking-wider italic">
                VENDA ITENS
              </label>
              <div className="font-mono text-2xl font-black text-status-sales tracking-tight mt-1">
                R$ {totalItensVenda.toFixed(2)}
              </div>
            </div>

            {/* SERVIÇO */}
            <div className="bg-white p-4.5 rounded-2xl shadow border-t-4 border-emerald-500">
              <label className="font-mono text-[10px] text-outline uppercase font-bold tracking-wider italic">
                SOMA SERVIÇO
              </label>
              <div className="font-mono text-2xl font-black text-emerald-600 tracking-tight mt-1">
                R$ {totalServicoVenda.toFixed(2)}
              </div>
            </div>

            {/* DIFERENÇA */}
            <div className="bg-white p-4.5 rounded-2xl shadow border-t-4 border-status-pending">
              <label className="font-mono text-[10px] text-outline uppercase font-bold tracking-wider italic">
                DIFERENÇA
              </label>
              <div className={`font-mono text-2xl font-black tracking-tight mt-1 ${diferencaTerminal < 0 ? "text-error" : diferencaTerminal > 0 ? "text-emerald-500" : "text-status-pending"}`}>
                R$ {diferencaTerminal.toFixed(2)}
              </div>
            </div>

          </div>

          {/* Shortcut actions panel - Accessible always */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <button
              onClick={() => {
                if (caixaTurno.aberto) {
                  const existingVenda = (caixaTurno.vendas || []).find((v) => v.turno === turno);
                  setVendaToEdit(existingVenda || null);
                  setIsVendaOpen(true);
                }
              }}
              disabled={!caixaTurno.aberto}
              className={`text-white font-mono font-bold py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-md active:scale-[0.98] transition-soft flex items-center justify-center gap-2 ${
                caixaTurno.aberto
                  ? "bg-status-sales hover:brightness-110 cursor-pointer"
                  : "bg-status-sales/45 opacity-50 cursor-not-allowed select-none"
              }`}
            >
              <ShoppingCart className="w-4 h-4" /> Informar Venda [V]
            </button>
            <button
              onClick={() => setIsConsolidadoOpen(true)}
              className="bg-secondary text-white font-mono font-bold py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-md hover:brightness-110 active:scale-[0.98] transition-soft flex items-center justify-center gap-2 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" /> Fechamento Diário [F]
            </button>
            <button
              onClick={() => setIsHistoricoFechamentosOpen(true)}
              className="bg-primary-container text-white font-mono font-bold py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-md hover:brightness-110 active:scale-[0.98] transition-soft flex items-center justify-center gap-2 cursor-pointer"
            >
              <History className="w-4 h-4" /> Re-Imprimir Histórico [H]
            </button>
            <button
              onClick={() => setIsListaPendentesOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-md active:scale-[0.98] transition-soft flex items-center justify-center gap-2 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-amber-200" /> Lista de Pendentes [L]
            </button>
          </div>

          {/* Operational Canvas Panel (Inhibited if closed) */}
          <div
            className={`transition-soft duration-500 space-y-6 ${
              !caixaTurno.aberto
                ? "opacity-40 pointer-events-none filter grayscale select-none"
                : ""
            }`}
          >
            
            {/* LOCKED BANNER INDICATOR */}
            {!caixaTurno.aberto && (
              <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4.5 rounded-xl flex items-center justify-between no-print shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                    <Lock className="w-[15px] h-[15px]" />
                  </div>
                  <div>
                    <h4 className="font-sans text-xs font-bold text-on-surface uppercase tracking-wide">
                      PAINÉL OPERACIONAL BLOQUEADO
                    </h4>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                      Abra o caixa no botão acima para faturamento e lançamentos. Consultas e fechamento continuam disponíveis.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick entry grid launch */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setLancamentoTipo("entrada");
                  setLancamentoToEdit(null);
                  setIsLancamentoOpen(true);
                }}
                className="bg-secondary text-white py-3.5 rounded-xl font-bold uppercase font-sans text-xs tracking-wide flex flex-col items-center justify-center gap-1 shadow-sm hover:brightness-115 active:scale-95 transition-soft cursor-pointer"
              >
                <PlusCircle className="w-5 h-5 mb-0.5" /> + CONSUMO / ENTRADAS [E]
              </button>

              <button
                onClick={() => {
                  setLancamentoTipo("saida");
                  setLancamentoToEdit(null);
                  setIsLancamentoOpen(true);
                }}
                className="bg-error text-white py-3.5 rounded-xl font-bold uppercase font-sans text-xs tracking-wide flex flex-col items-center justify-center gap-1 shadow-sm hover:brightness-115 active:scale-95 transition-soft cursor-pointer"
              >
                <MinusCircle className="w-5 h-5 mb-0.5" /> - AJUSTE DINHEIRO / SAÍDAS [S]
              </button>

              <button
                onClick={() => {
                  setLancamentoTipo("pendente");
                  setLancamentoToEdit(null);
                  setIsLancamentoOpen(true);
                }}
                className="bg-status-pending text-white py-3.5 rounded-xl font-bold uppercase font-sans text-xs tracking-wide flex flex-col items-center justify-center gap-1 shadow-sm hover:brightness-115 active:scale-95 transition-soft cursor-pointer"
              >
                <Clock className="w-5 h-5 mb-0.5" /> CONTAS PENDENTES [P]
              </button>
            </div>

            {/* Detailed Ledger Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* ENTRADAS */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm space-y-4">
                <div className="flex justify-between items-end border-b-2 border-secondary pb-2.5">
                  <h3 className="font-sans font-black text-secondary uppercase italic text-sm md:text-base flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span> ENTRADAS
                  </h3>
                  <span className="font-mono text-sm text-secondary font-bold">
                    R$ {entradasSum.toFixed(2)}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                  {caixaTurno.lancamentos?.filter(l => l.tipo === 'entrada' && fTurno(l)).length === 0 ? (
                    <p className="text-[11px] text-outline italic text-center py-6">Nenhum lançamento de entrada.</p>
                  ) : (
                    caixaTurno.lancamentos
                      ?.filter((l) => l.tipo === "entrada" && fTurno(l))
                      .map((l) => (
                        <div
                          key={l.id}
                          className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 flex justify-between items-center shadow-sm hover:border-secondary/40 transition-soft"
                        >
                          <div>
                            <span className="font-mono text-[8px] uppercase tracking-wider text-outline font-bold leading-tight block">
                              {l.descricao}
                            </span>
                            <span className="font-mono font-bold text-on-surface text-xs md:text-sm">
                              R$ {l.valor.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handlePrintItemComprovante(l)}
                              className="p-1.5 hover:bg-secondary/15 rounded-lg text-secondary transition-soft cursor-pointer"
                              title="Imprimir Cupom"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditLancamento(l)}
                              className="p-1.5 hover:bg-slate-300 rounded-lg text-on-surface-variant transition-soft cursor-pointer"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExcluirLancamento(l.id)}
                              className="p-1.5 hover:bg-error-container hover:text-error rounded-lg text-outline transition-soft cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* SAÍDAS */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm space-y-4">
                <div className="flex justify-between items-end border-b-2 border-error pb-2.5">
                  <h3 className="font-sans font-black text-rose-600 uppercase italic text-sm md:text-base flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-error"></span> SAÍDAS
                  </h3>
                  <span className="font-mono text-sm text-error font-bold">
                    R$ {saidasSum.toFixed(2)}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                  {caixaTurno.lancamentos?.filter(l => l.tipo === 'saida' && fTurno(l)).length === 0 ? (
                    <p className="text-[11px] text-outline italic text-center py-6">Nenhum lançamento de saída.</p>
                  ) : (
                    caixaTurno.lancamentos
                      ?.filter((l) => l.tipo === "saida" && fTurno(l))
                      .map((l) => (
                        <div
                          key={l.id}
                          className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 flex justify-between items-center shadow-sm hover:border-error/40 transition-soft"
                        >
                          <div>
                            <span className="font-mono text-[8px] uppercase tracking-wider text-outline font-bold leading-tight block">
                              {l.descricao}
                            </span>
                            <span className="font-mono font-bold text-on-surface text-xs md:text-sm">
                              R$ {l.valor.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handlePrintItemComprovante(l)}
                              className="p-1.5 hover:bg-secondary/15 rounded-lg text-secondary transition-soft cursor-pointer"
                              title="Imprimir Cupom"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditLancamento(l)}
                              className="p-1.5 hover:bg-slate-300 rounded-lg text-on-surface-variant transition-soft cursor-pointer"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExcluirLancamento(l.id)}
                              className="p-1.5 hover:bg-error-container hover:text-error rounded-lg text-outline transition-soft cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* PENDENTES */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-sm space-y-4">
                <div className="flex justify-between items-end border-b-2 border-status-pending pb-2.5">
                  <h3 className="font-sans font-black text-status-pending uppercase italic text-sm md:text-base flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-status-pending"></span> PENDENTES
                  </h3>
                  <span className="font-mono text-sm text-status-pending font-bold">
                    R$ {pendentesSum.toFixed(2)}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                  {caixaTurno.lancamentos?.filter(l => l.tipo === 'pendente' && fTurno(l)).length === 0 ? (
                    <p className="text-[11px] text-outline italic text-center py-6">Nenhum lançamento pendente.</p>
                  ) : (
                    caixaTurno.lancamentos
                      ?.filter((l) => l.tipo === "pendente" && fTurno(l))
                      .map((l) => (
                        <div
                          key={l.id}
                          className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 flex justify-between items-center shadow-sm hover:border-status-pending/40 transition-soft"
                        >
                          <div>
                            <span className="font-mono text-[8px] uppercase tracking-wider text-outline font-bold leading-tight block">
                              {l.descricao}
                            </span>
                            <span className="font-mono font-bold text-on-surface text-xs md:text-sm">
                              R$ {l.valor.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handlePrintItemComprovante(l)}
                              className="p-1.5 hover:bg-secondary/15 rounded-lg text-secondary transition-soft cursor-pointer"
                              title="Imprimir Cupom"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditLancamento(l)}
                              className="p-1.5 hover:bg-slate-300 rounded-lg text-on-surface-variant transition-soft cursor-pointer"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExcluirLancamento(l.id)}
                              className="p-1.5 hover:bg-error-container hover:text-error rounded-lg text-outline transition-soft cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer balance details: opening count vs final drawer conferência field */}
            <div className="pt-6 border-t-2 border-surface-container grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-4.5 rounded-2xl border-l-4 border-outline shadow-sm flex flex-col justify-center">
                <label className="font-mono text-[9px] text-outline font-bold uppercase tracking-wider block mb-1">
                  SALDO INICIAL (ABERTURA)
                </label>
                <div className="font-mono text-xl font-bold text-on-surface-variant">
                  R$ {(caixaTurno?.saldoInicial ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="bg-secondary-container/10 p-4 rounded-2xl border-l-4 border-secondary shadow-sm">
                <label className="font-mono text-[10px] text-secondary font-black uppercase tracking-wider block mb-1">
                  GAVETA FINAL (CONFERÊNCIA DE FECHAMENTO)
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-lg font-bold text-secondary">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full font-mono text-2xl font-black text-secondary bg-transparent border-none outline-none focus:ring-0 p-0"
                    placeholder="0.00"
                    value={saldoFinalInput}
                    onChange={(e) => setSaldoFinalInput(e.target.value)}
                  />
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* Floating elements backdrop if settings panel is focus or alerts */}
        <footer className="w-full text-center py-4 text-outline font-mono text-[10px] uppercase border-t border-surface-container mt-auto bg-white no-print">
          Terminal de Caixa Gênese &bull; Gestão Operacional Ágil &bull; {new Date().getFullYear()}
        </footer>

        {/* Bottom Tabs Nav (Mobile design matches the original) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-16 bg-white border-t border-outline-variant shadow-lg z-30 px-2 no-print">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="flex flex-col items-center justify-center text-secondary focus:outline-none flex-1 py-1"
          >
            <LayoutDashboard className="w-5 h-5 text-secondary" />
            <span className="font-sans text-[9px] font-bold uppercase mt-0.5">Dashboard</span>
          </button>
          
          <button
            onClick={() => {
              if (caixaTurno.aberto) {
                setLancamentoTipo("entrada");
                setLancamentoToEdit(null);
                setIsLancamentoOpen(true);
              } else {
                alert("Abra o caixa primeiro!");
              }
            }}
            className="flex flex-col items-center justify-center text-outline hover:text-secondary focus:outline-none flex-1 py-1 transition-soft"
          >
            <Wallet className="w-5 h-5" />
            <span className="font-sans text-[9px] font-bold uppercase mt-0.5">Lançamentos</span>
          </button>

          <button
            onClick={() => {
              if (caixaTurno.aberto) {
                setIsConsolidadoOpen(true);
              } else {
                alert("Abra o caixa primeiro!");
              }
            }}
            className="flex flex-col items-center justify-center text-outline hover:text-secondary focus:outline-none flex-1 py-1 transition-soft"
          >
            <Receipt className="w-5 h-5" />
            <span className="font-sans text-[9px] font-bold uppercase mt-0.5">Relatórios</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex flex-col items-center justify-center text-outline hover:text-secondary focus:outline-none flex-1 py-1 transition-soft"
          >
            <Zap className="w-5 h-5 animate-pulse" />
            <span className="font-sans text-[9px] font-bold uppercase mt-0.5">Ações</span>
          </button>
        </nav>

        {/* Trigger Popups */}
        <ModalVenda
          isOpen={isVendaOpen}
          onClose={() => {
            setIsVendaOpen(false);
            setVendaToEdit(null);
          }}
          onSave={handleSaveVenda}
          vendaToEdit={vendaToEdit}
        />

        <ModalLancamento
          isOpen={isLancamentoOpen}
          onClose={() => {
            setIsLancamentoOpen(false);
            setLancamentoTipo(null);
            setLancamentoToEdit(null);
          }}
          tipo={lancamentoTipo}
          itemToEdit={lancamentoToEdit}
          onSave={handleSaveLancamento}
          existentesClientes={Array.from(
            new Set<string>(
              (localDB.lancamentos || [])
                .filter((l) => l.tipo === "pendente" && l.loja === loja)
                .map((l) => l.descricao.trim())
            )
          ).sort() as string[]}
          onPrint={(descricao, valor, tipo) => {
            const tempItem: Lancamento = {
              id: Date.now(),
              descricao,
              valor,
              tipo,
              turno,
              data,
              loja
            };
            triggerMockPrint("item", tempItem, null, null);
          }}
        />

        <ModalConsolidado
          isOpen={isConsolidadoOpen}
          onClose={() => setIsConsolidadoOpen(false)}
          defaultLoja={loja}
          defaultData={data}
          vendas={localDB.vendas || []}
          lancamentos={localDB.lancamentos || []}
          dadosManuais={localDB.dadosManuais || {}}
          onSaveDadosManuais={handleSaveDadosManuais}
          onPrintReport={(aggData) => triggerMockPrint("consolidado", null, null, aggData)}
        />

        <ModalListaPendentes
          isOpen={isListaPendentesOpen}
          onClose={() => setIsListaPendentesOpen(false)}
          lancamentos={localDB.lancamentos || []}
          activeLoja={loja}
          lojasDisponiveis={(localDB.lojas && localDB.lojas.length > 0) ? localDB.lojas : ["Loja Matriz", "Filial Centro", "Filial Shopping"]}
          caixaAberto={caixaTurno.aberto}
          onSavePayment={handleSavePaymentPendente}
          onPrintRecebimento={handlePrintPaymentReceipt}
          onAddLancamentoPendente={handleAddLancamentoPendenteDirect}
          onPrintListaPendentes={handlePrintListaPendentes}
          onUpdateLancamentos={handleUpdateLancamentosDirect}
        />

        <ModalAbrirCaixa
          isOpen={isAbrirCaixaOpen}
          onClose={() => setIsAbrirCaixaOpen(false)}
          onConfirm={handleAbrirCaixaConfirm}
          defaultLoja={loja}
          defaultTurno={turno}
        />

        <ModalFecharCaixa
          isOpen={isFecharCaixaOpen}
          onClose={() => setIsFecharCaixaOpen(false)}
          onConfirm={handleFecharCaixaConfirm}
          sessionData={{
            loja,
            turno,
            operador,
            data,
            saldoInicial: caixaTurno.saldoInicial,
            volumeLiquido,
            vendasItens: totalItensVenda,
            servicos: totalServicoVenda,
            diferenca: diferencaTerminal,
          }}
        />

        <ModalHistoricoFechamentos
          isOpen={isHistoricoFechamentosOpen}
          onClose={() => setIsHistoricoFechamentosOpen(false)}
          historico={localDB.historicoFechamentos || []}
          onReimprimir={handleReimprimirHistoricoDirect}
          onReabrir={handleReabrirQualquerCaixa}
        />

        {/* Welcome Selection Modal Overlay */}
        <AnimatePresence>
          {isWelcomeModalOpen && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6 text-center text-white"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black font-sans tracking-tight">Terminal de Caixa Gênese</h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Selecione como deseja iniciar sua jornada de trabalho hoje. Você pode mudar de tela a qualquer momento.
                  </p>
                </div>

                <div className="space-y-3.5 pt-2">
                  {/* Option A: Open Cashier Terminal */}
                  <button
                    type="button"
                    onClick={() => setIsWelcomeModalOpen(false)}
                    className="w-full text-left p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/45 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group flex items-start gap-4"
                  >
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-900 transition-all">
                      <LayoutDashboard className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <div className="font-sans font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                        💻 Terminal de Caixa (Tela Principal)
                      </div>
                      <div className="text-[11px] text-slate-400 leading-normal mt-1">
                        Acesso completo ao painel operacional para registrar vendas, gerenciar despesas, entradas e consolidar gaveta de dinheiro.
                      </div>
                    </div>
                  </button>

                  {/* Option B: Open Daily Sales Reports (Modal Consolidado) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsWelcomeModalOpen(false);
                      setIsConsolidadoOpen(true);
                    }}
                    className="w-full text-left p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-teal-500/45 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group flex items-start gap-4"
                  >
                    <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl group-hover:bg-teal-500 group-hover:text-slate-900 transition-all">
                      <BarChart3 className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <div className="font-sans font-bold text-sm text-white group-hover:text-teal-400 transition-colors">
                        📊 Ver Vendas (Fechamento Diário [F])
                      </div>
                      <div className="text-[11px] text-slate-400 leading-normal mt-1">
                        Visualizar relatórios gerenciais, faturamento por turno, despesas agregadas e realizar auditoria diária simplificada.
                      </div>
                    </div>
                  </button>
                </div>

                <div className="border-t border-slate-800/85 pt-4 text-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                    Dica: use o atalho <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[8px] border border-slate-700 font-sans text-slate-300">F</kbd> para abrir o Fechamento Diário a qualquer momento
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      {/* Hidden layout specifically customized for printer spool printArea */}
      <PrintAreaElement
        printType={printType}
        activeItem={printItem}
        activeFechamento={printFechamento}
        activeConsolidado={printConsolidado}
        activeRecebimento={printRecebimento}
        activeListaPendentes={printListaPendentes}
      />
    </>
  );
}
