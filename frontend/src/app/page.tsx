"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Lock,
  User,
  RefreshCw,
  Download,
  TrendingUp,
  MapPin,
  Users,
  Calendar,
  LogOut,
  Target,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Filter,
} from "lucide-react";

// --- Types & Interfaces ---
interface Opportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  createdAt: string;
  monetaryValue: number;
  distrito: string;
  gestor: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface DashboardData {
  summary: {
    total: number;
    en_aprobacion: number;
    pendiente_carta: number;
    en_construccion: number;
    liquidado: number;
  };
  opportunities: Opportunity[];
}

interface UserSession {
  username: string;
  name: string;
  role: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// GHL stage constants to map opportunity stages
const STAGE_ESPERANDO_WIN = "fdc27149-b398-4ed7-9271-946c66dc9f0f";
const STAGE_FICHA_DATOS_ENVIADA_WIN = "085ad64f-769b-42f7-986d-6eef802f0634";
const STAGE_PENDIENTE_INICIO_HABILITACION = "f251b78c-b57f-4cbd-aa61-3653b54c7677";
const STAGE_EN_HABILITACION_TECNICA = "46400c15-10a3-4c96-a5b0-76f0cf65b753";
const STAGE_HABILITACION_COMPLETA = "dc5a218f-50a8-4bb6-9351-82b2f10d9886";

const localStagesMapping: Record<string, string> = {
  [STAGE_ESPERANDO_WIN]: "EN APROBACION WIN",
  [STAGE_FICHA_DATOS_ENVIADA_WIN]: "PENDIENTE CARTA",
  [STAGE_PENDIENTE_INICIO_HABILITACION]: "EN CONSTRUCCION",
  [STAGE_EN_HABILITACION_TECNICA]: "EN CONSTRUCCION",
  [STAGE_HABILITACION_COMPLETA]: "PROYECTO LIQUIDADO",
};

// --- Subcomponents ---

// 1. Premium Glassmorphic Tooltip
const CustomChartTooltip = ({ active, payload, label, suffix = "" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-md bg-white/95 border border-slate-200/60 rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(148,163,184,0.15)]">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-sm font-extrabold text-teal-600">
          {payload[0].name}: <span className="text-slate-800">{payload[0].value} {suffix}</span>
        </p>
      </div>
    );
  }
  return null;
};

// 2. Animated Number Counter for Premium Look
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 600; // ms
    const startTime = performance.now();

    let animationFrameId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const ease = progress * (2 - progress);
      const current = Math.round(start + (end - start) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <span>{displayValue}</span>;
}

// --- Main Page Component ---
export default function Home() {
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Data State
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metaMensual, setMetaMensual] = useState<number>(40);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filter States
  const [selectedGestor, setSelectedGestor] = useState<string>("Todos");
  const [selectedDistrito, setSelectedDistrito] = useState<string>("Todos");

  // Check auth on mount
  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem("crm_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem("crm_user");
      }
    }
  }, []);

  // Fetch metrics from API
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/metrics`);
      if (!res.ok) {
        throw new Error("No se pudieron cargar las métricas de GHL");
      }
      const jsonData: DashboardData = await res.json();
      setData(jsonData);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  // Auth Submit Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Credenciales incorrectas");
      }

      const loginResult = await res.json();
      if (loginResult.status === "success") {
        localStorage.setItem("crm_user", JSON.stringify(loginResult.user));
        setUser(loginResult.user);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      setLoginError(err.message || "Error de conexión con el servidor");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("crm_user");
    setUser(null);
    setIsAuthenticated(false);
    setData(null);
    setLoginUsername("");
    setLoginPassword("");
    setSelectedGestor("Todos");
    setSelectedDistrito("Todos");
  };

  const handleSync = () => {
    fetchDashboardData();
  };

  // Exporters
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/export/excel`);
      if (!response.ok) throw new Error("Error en exportación");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_CRM_Fichas_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Error al descargar el reporte Excel");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/export/pdf`);
      if (!response.ok) throw new Error("Error en exportación");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_CRM_Resumen_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Error al descargar el reporte PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // --- Real GHL Mappings ---
  // Map internal database gestor codes ("JP", "YESEN", "OTROS") to official professional names
  const rawOpportunities = useMemo(() => data?.opportunities || [], [data]);

  const opportunities = useMemo(() => {
    return rawOpportunities.map((o) => {
      let mappedGestor = "Otros";
      if (o.gestor === "JP") mappedGestor = "Jean Pierre Sihue";
      else if (o.gestor === "YESEN") mappedGestor = "Yasmin Mendoza";
      else if (o.gestor && o.gestor !== "OTROS") mappedGestor = o.gestor;
      
      return {
        ...o,
        gestor: mappedGestor,
      };
    });
  }, [rawOpportunities]);

  // Extract filter options dynamically from mapped data
  const gestoresList = useMemo(() => {
    const unique = new Set(opportunities.map((o) => o.gestor).filter(Boolean));
    return ["Todos", ...Array.from(unique)].sort();
  }, [opportunities]);

  const distritosList = useMemo(() => {
    const unique = new Set(opportunities.map((o) => o.distrito).filter(Boolean));
    return ["Todos", ...Array.from(unique)].sort();
  }, [opportunities]);

  // Filter application
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((o) => {
      const matchGestor = selectedGestor === "Todos" || o.gestor === selectedGestor;
      const matchDistrito = selectedDistrito === "Todos" || o.distrito === selectedDistrito;
      return matchGestor && matchDistrito;
    });
  }, [opportunities, selectedGestor, selectedDistrito]);

  // Recalculate summary metrics from filtered opportunities
  const filteredSummary = useMemo(() => {
    let total = filteredOpportunities.length;
    let en_aprobacion = 0;
    let pendiente_carta = 0;
    let en_construccion = 0;
    let liquidado = 0;

    filteredOpportunities.forEach((o) => {
      const category = localStagesMapping[o.pipelineStageId] || "OTROS";
      if (category === "EN APROBACION WIN") en_aprobacion++;
      else if (category === "PENDIENTE CARTA") pendiente_carta++;
      else if (category === "EN CONSTRUCCION") en_construccion++;
      else if (category === "PROYECTO LIQUIDADO") liquidado++;
    });

    return { total, en_aprobacion, pendiente_carta, en_construccion, liquidado };
  }, [filteredOpportunities]);

  // Current Month counts (filtered) for gauge achievement
  const currentMonthQty = useMemo(() => {
    if (filteredOpportunities.length === 0) return 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return filteredOpportunities.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
  }, [filteredOpportunities]);

  const achievementPercentage = useMemo(() => {
    if (metaMensual <= 0) return 0;
    return Math.min(Math.round((currentMonthQty / metaMensual) * 100), 1000);
  }, [currentMonthQty, metaMensual]);

  const gaugeColor = useMemo(() => {
    if (achievementPercentage < 40) return "#f43f5e"; // Rose
    if (achievementPercentage < 80) return "#fbbf24"; // Amber
    return "#10b981"; // Emerald
  }, [achievementPercentage]);

  // Recharts: Area Cumulative Data starting June 1st, 2026
  const areaChartData = useMemo(() => {
    if (filteredOpportunities.length === 0) return [];
    
    const startDate = new Date(2026, 5, 1); // June 1st, 2026 (month is 0-indexed, so 5 is June)

    // Sort chronologically
    const sorted = [...filteredOpportunities].sort((a, b) => {
      const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dA - dB;
    });

    // Compute cumulative counts
    let runningTotal = 0;
    const dataPoints: { fecha: string; timestamp: number; cantidad: number }[] = [];
    
    sorted.forEach((opp) => {
      runningTotal += 1;
      if (opp.createdAt) {
        const oppDate = new Date(opp.createdAt);
        if (oppDate >= startDate) {
          // Format as "01 Jun" (Easier to understand)
          const day = oppDate.getDate().toString().padStart(2, '0');
          const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
          const month = monthNames[oppDate.getMonth()];
          const dateLabel = `${day} ${month}`;
          
          dataPoints.push({
            fecha: dateLabel,
            timestamp: oppDate.getTime(),
            cantidad: runningTotal,
          });
        }
      }
    });
    
    return dataPoints;
  }, [filteredOpportunities]);

  // Recharts: District Data
  const distritosChartData = useMemo(() => {
    if (filteredOpportunities.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredOpportunities.forEach((o) => {
      const d = o.distrito || "SIN DISTRITO";
      counts[d] = (counts[d] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.value - b.value);
  }, [filteredOpportunities]);

  // Recharts: Gestor Data
  const gestorChartData = useMemo(() => {
    if (filteredOpportunities.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredOpportunities.forEach((o) => {
      const g = o.gestor || "Otros";
      counts[g] = (counts[g] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.value - b.value);
  }, [filteredOpportunities]);

  // Recharts: Comparatives (Filtered)
  const temporalComparisons = useMemo(() => {
    if (filteredOpportunities.length === 0) {
      return {
        monthly: { anterior: 0, actual: 0 },
        weekly: { anterior: 0, actual: 0 },
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let prevMonth = currentMonth - 1;
    let prevMonthYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevMonthYear = currentYear - 1;
    }

    const actMonthQty = filteredOpportunities.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;

    const antMonthQty = filteredOpportunities.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return d.getFullYear() === prevMonthYear && d.getMonth() === prevMonth;
    }).length;

    // Weeks
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - daysToMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfPrevWeek = new Date(startOfCurrentWeek);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const actWeekQty = filteredOpportunities.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt).getTime();
      return d >= startOfCurrentWeek.getTime() && d < startOfCurrentWeek.getTime() + 7 * 24 * 60 * 60 * 1000;
    }).length;

    const antWeekQty = filteredOpportunities.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt).getTime();
      return d >= startOfPrevWeek.getTime() && d < startOfCurrentWeek.getTime();
    }).length;

    return {
      monthly: { anterior: antMonthQty, actual: actMonthQty },
      weekly: { anterior: antWeekQty, actual: actWeekQty },
    };
  }, [filteredOpportunities]);

  // Hydration Guard
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-teal-600" size={32} />
      </div>
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 overflow-hidden px-4 font-sans">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-emerald-500" />

        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-8">
              <motion.h1 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.2 }}
                className="text-4xl font-black text-slate-800 tracking-tight"
              >
                FUTURA <span className="text-teal-600">PERÚ</span>
              </motion.h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mt-1">
                Portal de Control Operativo
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-8 shadow-[0_20px_50px_rgba(148,163,184,0.12)]">
              <h2 className="text-xl font-extrabold text-slate-800 text-center mb-6">
                Autenticación Requerida
              </h2>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                    Usuario corporativo
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User size={18} />
                    </span>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-slate-800 font-medium transition-all placeholder-slate-400"
                      placeholder="Ej: josue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 text-slate-800 font-medium transition-all placeholder-slate-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 p-3.5 bg-red-55/75 border border-red-200 rounded-2xl text-xs text-red-600 font-bold"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{loginError}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoggingIn ? "Autenticando..." : "Entrar al Portal"}
                </button>
              </form>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Active Dashboard
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Sticky Panel */}
      <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col p-6 shrink-0 shadow-sm md:h-screen md:sticky md:top-0 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8 justify-between md:justify-start">
            <h2 className="text-2xl font-black text-teal-600 tracking-tight">FUTURA PERÚ</h2>
            <button
              onClick={handleLogout}
              className="md:hidden p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-50 transition-all"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* User Display Info */}
          {user && (
            <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-5 mb-8 text-center relative overflow-hidden">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                OPERADOR TI
              </span>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">
                {user.name}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                {user.role}
              </p>
            </div>
          )}

          {/* Meta Mensual configuration */}
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                <Target size={16} className="text-teal-600" />
                <span>Meta: {metaMensual} Predios</span>
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={metaMensual}
                onChange={(e) => setMetaMensual(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-black mt-2">
                <span>5</span>
                <span>60</span>
                <span>120</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar bottom sync & logout */}
        <div className="pt-6 border-t border-slate-100 space-y-3">
          <button
            onClick={handleSync}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-teal-50 border border-teal-200/60 hover:bg-teal-100/60 text-teal-700 font-extrabold text-xs rounded-2xl transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            <span>Sincronizar Datos</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full hidden md:flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-600 font-extrabold text-xs rounded-2xl transition-all"
          >
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
        
        {/* Header Title Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              DASHBOARD COMERCIAL
            </h1>
            {user && (
              <p className="text-xs text-slate-400 font-bold mt-1">
                Bienvenido, <span className="text-teal-600">{user.name}</span> | Acceso de Rol: {user.role}
              </p>
            )}
          </div>

          <div className="self-start md:self-center bg-emerald-50 border border-emerald-200/60 rounded-full px-4 py-1.5 flex items-center gap-2.5">
            <span className="pulse-dot" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
              Online
            </span>
          </div>
        </motion.div>

        {error && (
          <div className="mb-8 p-4 bg-red-55/70 border border-red-200 rounded-3xl flex items-center gap-3 text-red-700 text-sm font-semibold">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw size={40} className="animate-spin text-teal-600" />
            <p className="text-slate-400 font-bold text-sm">Estableciendo sincronización...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Interactive Filters Panel */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                <Filter size={16} className="text-teal-600" />
                <span>Filtros Rápidos Interactivos</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gestor Filters */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    Gestor Comercial (Hunter):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {gestoresList.map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGestor(g)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                          selectedGestor === g
                            ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/10"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distrito Filters */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    Ubicación (Distrito):
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-100">
                    {distritosList.map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDistrito(d)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                          selectedDistrito === d
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/10"
                            : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "TOTAL PREDIO / OPP", value: filteredSummary.total, color: "text-slate-800", hoverColor: "hover:shadow-[0_15px_30px_-5px_rgba(71,85,105,0.08)]", border: "border-slate-200" },
                { label: "EN APROBACION WIN", value: filteredSummary.en_aprobacion, color: "text-teal-600", hoverColor: "hover:shadow-[0_15px_30px_-5px_rgba(20,184,166,0.1)] hover:border-teal-300", border: "border-teal-200/50" },
                { label: "PENDIENTE CARTA", value: filteredSummary.pendiente_carta, color: "text-amber-600", hoverColor: "hover:shadow-[0_15px_30px_-5px_rgba(245,158,11,0.1)] hover:border-amber-300", border: "border-amber-200/50" },
                { label: "EN CONSTRUCCION", value: filteredSummary.en_construccion, color: "text-blue-600", hoverColor: "hover:shadow-[0_15px_30px_-5px_rgba(59,130,246,0.1)] hover:border-blue-300", border: "border-blue-200/50" },
                { label: "PROYECTO LIQUIDADO", value: filteredSummary.liquidado, color: "text-emerald-600", hoverColor: "hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.1)] hover:border-emerald-300", border: "border-emerald-200/50" },
              ].map((kpi, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className={`bg-white border ${kpi.border} rounded-3xl p-6 shadow-[0_4px_12px_rgba(148,163,184,0.03)] flex flex-col justify-between ${kpi.hoverColor} transition-all duration-350`}
                >
                  <span className="text-[9px] font-black text-slate-400 tracking-wider block uppercase mb-3">
                    {kpi.label}
                  </span>
                  <span className={`text-4xl font-black tracking-tight ${kpi.color}`}>
                    <AnimatedNumber value={kpi.value} />
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Core Analytics: Embudo & Progress Gauge */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Funnel Block (with total opportunities included) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-7 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={20} className="text-teal-600" />
                      Embudo de Conversión de Operaciones
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      (Leyenda: Porcentaje del total general de oportunidades filtradas)
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {[
                      { name: "Total Oportunidades", value: filteredSummary.total, percent: 100, color: "bg-slate-400" },
                      { name: "En Aprobación WIN", value: filteredSummary.en_aprobacion, percent: filteredSummary.total ? Math.round((filteredSummary.en_aprobacion / filteredSummary.total) * 100) : 0, color: "bg-teal-500" },
                      { name: "Pendiente Carta", value: filteredSummary.pendiente_carta, percent: filteredSummary.total ? Math.round((filteredSummary.pendiente_carta / filteredSummary.total) * 100) : 0, color: "bg-amber-500" },
                      { name: "En Construcción", value: filteredSummary.en_construccion, percent: filteredSummary.total ? Math.round((filteredSummary.en_construccion / filteredSummary.total) * 100) : 0, color: "bg-blue-500" },
                      { name: "Proyecto Liquidado", value: filteredSummary.liquidado, percent: filteredSummary.total ? Math.round((filteredSummary.liquidado / filteredSummary.total) * 100) : 0, color: "bg-emerald-500" },
                    ].map((step, idx) => (
                      <div key={idx} className="relative">
                        <div className="flex items-center justify-between mb-1.5 text-xs font-bold">
                          <span className="text-slate-500 uppercase tracking-wider">{step.name}</span>
                          <span className="text-slate-800">
                            {step.value} <span className="text-slate-400 font-semibold">({step.percent}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${step.percent}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full ${step.color} rounded-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inline Exporters */}
                <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap gap-3">
                  <button
                    onClick={handleExportExcel}
                    disabled={isExportingExcel}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 border border-slate-200 text-slate-600 font-extrabold text-xs rounded-2xl transition-all"
                  >
                    <FileSpreadsheet size={15} />
                    <span>{isExportingExcel ? "Exportando..." : "Descargar Excel"}</span>
                  </button>

                  <button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-600 font-extrabold text-xs rounded-2xl transition-all"
                  >
                    <FileText size={15} />
                    <span>{isExportingPdf ? "Exportando..." : "Descargar PDF"}</span>
                  </button>
                </div>
              </motion.div>

              {/* Progress Target Arc Gauge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-5 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Target size={20} className="text-teal-600" />
                    Meta Mensual (Predios)
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    (Leyenda: Progreso de predios cerrados en el mes)
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center py-4 relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="65"
                      stroke="#f1f5f9"
                      strokeWidth="12"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="65"
                      stroke={gaugeColor}
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={408.4}
                      initial={{ strokeDashoffset: 408.4 }}
                      animate={{ strokeDashoffset: 408.4 - (408.4 * Math.min(achievementPercentage, 100)) / 100 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-black text-slate-800 tracking-tight">
                      {currentMonthQty}
                    </span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                      de {metaMensual}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-center mt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    LOGRO DEL MES
                  </span>
                  <span className="text-lg font-black text-teal-600">
                    {achievementPercentage}% Alcanzado
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Time Trends & Geographical Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Cumulative Line-Area Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp size={20} className="text-teal-600" />
                    Crecimiento Acumulado del Pipeline
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    (Leyenda: Total acumulado de predios en el tiempo, desde el 01 de Junio)
                  </p>
                </div>

                <div className="h-72 w-full">
                  {areaChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                      Sin datos desde el 1 de Junio
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaChartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                        <XAxis
                          dataKey="fecha"
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="700"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="700"
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomChartTooltip suffix="Opps" />} />
                        <Area
                          type="monotone"
                          dataKey="cantidad"
                          name="Total Acumulado"
                          stroke="#10b981"
                          strokeWidth={3.5}
                          fillOpacity={1}
                          fill="url(#colorAcumulado)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>

              {/* Geographic District Bar Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <MapPin size={20} className="text-teal-600" />
                    Distribución Geográfica (Distritos)
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    (Leyenda: Cantidad de predios por distrito)
                  </p>
                </div>

                <div className="h-72 w-full">
                  {distritosChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                      Sin datos geográficos
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={distritosChartData}
                        layout="vertical"
                        margin={{ left: 15, right: 30, top: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" horizontal={false} />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="700"
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomChartTooltip suffix="Predios" />} />
                        <Bar dataKey="value" name="Predios" barSize={14} fill="#0d9488" radius={[0, 6, 6, 0]}>
                          {distritosChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#0d9488" : "#10b981"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Gestores & Comparatives */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Gestores Bar Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-5 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users size={20} className="text-teal-600" />
                    Predios por Gestor Comercial
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    (Leyenda: Distribución de predios asignados por gestor)
                  </p>
                </div>

                <div className="h-64 w-full">
                  {gestorChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                      Sin datos de gestores
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={gestorChartData}
                        layout="vertical"
                        margin={{ left: 25, right: 30, top: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" horizontal={false} />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={10}
                          fontWeight="700"
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomChartTooltip suffix="Predios" />} />
                        <Bar dataKey="value" name="Asignados" barSize={12} fill="#94a3b8" radius={[0, 6, 6, 0]}>
                          {gestorChartData.map((entry, index) => {
                            let barColor = "#94a3b8";
                            if (entry.name === "Jean Pierre Sihue") barColor = "#10b981";
                            else if (entry.name === "Yasmin Mendoza") barColor = "#8b5cf6";
                            return <Cell key={`cell-${index}`} fill={barColor} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>

              {/* Temporal Period Comparatives */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-7 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={20} className="text-teal-600" />
                    Comparativas Temporales
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    (Leyenda: Predios ingresados por período)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Monthly */}
                  <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
                      Comparativo Mensual
                    </span>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { label: "Mes Anterior", cantidad: temporalComparisons.monthly.anterior },
                            { label: "Mes Actual", cantidad: temporalComparisons.monthly.actual },
                          ]}
                          margin={{ top: 10, bottom: 5 }}
                        >
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} fontWeight="700" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="700" tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomChartTooltip suffix="Predios" />} cursor={{ fill: "transparent" }} />
                          <Bar dataKey="cantidad" name="Predios" barSize={32} radius={[6, 6, 0, 0]}>
                            <Cell fill="#94a3b8" />
                            <Cell fill="#10b981" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Weekly */}
                  <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
                      Comparativo Semanal
                    </span>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { label: "Semana Anterior", cantidad: temporalComparisons.weekly.anterior },
                            { label: "Semana Actual", cantidad: temporalComparisons.weekly.actual },
                          ]}
                          margin={{ top: 10, bottom: 5 }}
                        >
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} fontWeight="700" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="700" tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomChartTooltip suffix="Predios" />} cursor={{ fill: "transparent" }} />
                          <Bar dataKey="cantidad" name="Predios" barSize={32} radius={[6, 6, 0, 0]}>
                            <Cell fill="#94a3b8" />
                            <Cell fill="#3b82f6" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
