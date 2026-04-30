import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    MapPin, Calendar, AlertCircle, Truck, Filter, Map as MapIcon,
    Clock, User, Hash, CheckCircle, Download, Cloud, CloudOff,
    Loader2, Navigation, LogOut, Monitor, Smartphone, ChevronRight,
    Play, ChevronDown, ChevronUp, FileText, Package, X, Upload,
    Printer, RefreshCw, PhoneCall, MessageCircle, Lock, KeyRound
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

// --- 1. CONFIGURACIÓN FIREBASE ---
// Crea un archivo .env.local en la raíz del proyecto con tus credenciales de Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

// --- DATOS DE MUESTRA BÁSICOS ---
const mockData = [
    {
        id: '245526',
        nroCliente: '474724',
        tipo: 'RECLAMO',
        cliente: 'ALFONSO ROSARIO CELIA',
        direccion: 'MANUEL ALFONSO 705, ALTA GRACIA',
        fechaIngreso: '1998-08-28',
        fechaReclamo: '2026-04-27',
        prioridad: '4-BAJA',
        movil: 'MÓVIL 4',
        lat: -31.6529,
        lng: -64.4283,
        estado: 'PENDIENTE',
        observacion: 'CABLEMODEM/ONT OFF LINE - Brrio: TIRO FEDERAL ESQ. MAESTRO HERRERA',
        servicios: 'SERVICIO INTERNET RESIDENCIAL 12 MBPS WIFI',
        demora: 15,
        reagendos: 2,
        telefono: '3547576363',
        rawData: {
            "NROORDEN": "245526",
            "NROCLIENTE": "474724",
            "NOMBRE": "ALFONSO ROSARIO CELIA",
            "LOCALIDAD": "ALTA GRACIA"
        }
    },
    {
        id: '244207',
        nroCliente: '5809755',
        tipo: 'INSTALACION',
        cliente: 'HAMMER PATRICIA ROSA',
        direccion: 'CASTELLANOS 347, ALTA GRACIA',
        fechaIngreso: '2026-04-07',
        fechaReclamo: '2026-04-07',
        prioridad: '1-CRÍTICA',
        movil: 'MÓVIL 1',
        lat: -31.660048,
        lng: -64.434413,
        estado: 'PENDIENTE',
        observacion: 'La baja anticipada del servicio lo condiciona...',
        servicios: 'PROMO FIJA SINGULAR 50 MG',
        demora: 0,
        reagendos: 0,
        telefono: '3547642861',
        rawData: {
            "NROORDEN": "244207",
            "NROCLIENTE": "5809755",
            "NOMBRE": "HAMMER PATRICIA ROSA",
            "PROMOCION": "PROMO FIJA SINGULAR 50 MG - TAJAMAR - S2025",
            "ARTICULO SERIE": "212-2548-666",
            "TURNO": "TURNO MAÑANA"
        }
    }
];

const prioridades = ['1-CRÍTICA', '2-ALTA', '3-MEDIA', '4-BAJA'];
const moviles = ['SIN ASIGNAR', 'MÓVIL 1', 'MÓVIL 2', 'MÓVIL 3', 'MÓVIL 4'];

const contraseñasMoviles = {
    'MÓVIL 1': 'movil1',
    'MÓVIL 2': 'movil2',
    'MÓVIL 3': 'movil3',
    'MÓVIL 4': 'movil4'
};

// --- COMPONENTES AUXILIARES DE DISEÑO ---
const getPriorityColor = (prioridad) => {
    if (prioridad.includes('1-')) return 'bg-red-100 text-red-800 border-red-300';
    if (prioridad.includes('2-')) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (prioridad.includes('3-')) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
};

const getMovilColor = (movil) => {
    if (movil === 'SIN ASIGNAR') return 'bg-slate-100 text-slate-600';
    return 'bg-emerald-100 text-emerald-800 font-semibold';
};

// Generador de HTML para el Mapa Real con Leaflet
const generateMapHTML = (tasks) => {
    const markers = tasks.map(t => {
        let color = '#94a3b8'; // gris
        let extraCss = '';

        if (t.estado === 'EN CURSO') {
            color = '#3b82f6'; // azul
            extraCss = 'animation: pulseMap 1.5s infinite;';
        } else if (t.movil !== 'SIN ASIGNAR') {
            color = '#10b981'; // verde
        }

        const movilMatch = t.movil.match(/\d+/);
        const movilNum = movilMatch ? movilMatch[0] : '';

        // FIX: HTML del icono correctamente formateado
        const iconHtml = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; font-family: sans-serif; line-height: 1; ${extraCss}">${movilNum}</div>`;
        // FIX: regex sin espacio inválido
        const cliente = (t.cliente || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');
        const direccion = (t.direccion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');

        if (isNaN(t.lat) || isNaN(t.lng) || t.lat === 0 || t.lng === 0) return '';

        const movilesOptions = ['SIN ASIGNAR', 'MÓVIL 1', 'MÓVIL 2', 'MÓVIL 3', 'MÓVIL 4'].map(m =>
            `<option value="${m}" ${t.movil === m ? 'selected' : ''}>${m}</option>`
        ).join('');

        const popupHtmlRaw = `
      <div style="font-family: sans-serif; width: 200px;">
        <strong style="font-size: 14px;">${cliente}</strong><br/>
        <span style="color: #4f46e5; font-weight: bold;">${t.tipo}</span> • <span style="color: #64748b;">${t.movil}</span><br/>
        <span style="color: #64748b; font-size: 12px; display: inline-block; margin-top: 4px;">${direccion}</span>
        <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          <label style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Asignar a móvil:</label>
          <div style="display: flex; gap: 4px; margin-top: 4px;">
            <select id="sel-${t.id}" style="flex: 1; padding: 4px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; outline: none;">
              ${movilesOptions}
            </select>
            <button onclick="window.parent.postMessage({ type: 'ASSIGN_TASK', taskId: '${t.id}', movil: document.getElementById('sel-${t.id}').value }, '*')" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">OK</button>
          </div>
        </div>
      </div>
    `;

        const safeIconHtml = iconHtml.replace(/`/g, "\\`");
        const safePopupHtml = popupHtmlRaw.replace(/`/g, "\\`");

        return `
      L.marker([${t.lat}, ${t.lng}], {
        icon: L.divIcon({ html: \`${safeIconHtml}\`, className: '', iconSize: [24, 24], iconAnchor: [12, 12] })
      })
      .bindPopup(\`${safePopupHtml}\`)
      .addTo(map);
    `;
    }).join('');

    const validTasks = tasks.filter(t => !isNaN(t.lat) && !isNaN(t.lng) && t.lat !== 0 && t.lng !== 0);

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #f8fafc; }
        #map { width: 100vw; height: 100vh; }
        @keyframes pulseMap {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([-31.6529, -64.4283], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        ${markers}

        var bounds = [];
        ${validTasks.map(t => `bounds.push([${t.lat}, ${t.lng}]);`).join('\n')}
        if(bounds.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
      </script>
    </body>
    </html>
  `;
};

// ==========================================
// VISTA: DASHBOARD ADMINISTRADOR
// ==========================================
function AdminDashboard({ tasks, onUpdateTask, syncStatus, onLogout }) {
    const [filterMovil, setFilterMovil] = useState('TODOS');
    const [filterTipo, setFilterTipo] = useState('TODOS');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedMapTask, setSelectedMapTask] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'ASSIGN_TASK') {
                onUpdateTask(event.data.taskId, 'movil', event.data.movil);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onUpdateTask]);

    const filteredAndSortedTasks = useMemo(() => {
        let result = [...tasks];
        if (filterMovil !== 'TODOS') result = result.filter(task => task.movil === filterMovil);
        if (filterTipo !== 'TODOS') result = result.filter(task => task.tipo === filterTipo);

        result.sort((a, b) => {
            const dateA = new Date(a.fechaReclamo).getTime();
            const dateB = new Date(b.fechaReclamo).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return result;
    }, [tasks, filterMovil, filterTipo, sortOrder]);

    const handleExportCSV = () => {
        const headers = ['MOVIL_ASIGNADO', 'PRIORIDAD_ACTUAL', 'NRO_ORDEN', 'NRO_CLIENTE', 'TIPO_TAREA', 'CLIENTE', 'TELEFONO', 'DIRECCION', 'FECHA_INGRESO_CLIENTE', 'FECHA_TAREA', 'ESTADO', 'SERVICIOS', 'OBSERVACION', 'LATITUD', 'LONGITUD', 'DIAS_DEMORA', 'VECES_REAGENDADA'];
        const rows = tasks.map(task => [
            task.movil, task.prioridad, task.id, task.nroCliente, task.tipo, `"${task.cliente}"`, task.telefono || '', `"${task.direccion}"`, task.fechaIngreso, task.fechaReclamo, task.estado, `"${task.servicios || ''}"`, `"${task.observacion || ''}"`, task.lat, task.lng, task.demora || 0, task.reagendos || 0
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'tareas_asignadas_actualizadas.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCSV = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setIsImporting(true);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const text = await file.text();
                const cleanText = text.replace(/^﻿/, '');
                const lines = cleanText.split('\n');
                if (lines.length < 2) continue;

                const headerLine = lines[0];
                const separador = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
                const headers = headerLine.split(separador).map(h => h.replace(/^"|"$/g, '').trim().toUpperCase());

                const idx = {
                    id: headers.indexOf('NROORDEN'),
                    nroCliente: headers.indexOf('NROCLIENTE'),
                    tipo: headers.indexOf('TIPOORDEN'),
                    cliente: headers.indexOf('NOMBRE'),
                    calle: headers.indexOf('NOMBRECALLE'),
                    puerta: headers.indexOf('PUERTA'),
                    localidad: headers.indexOf('LOCALIDAD'),
                    fechaIngreso: headers.indexOf('FECHA INGRESO CLIENTE'),
                    fechaReclamo: headers.indexOf('FECHA'),
                    prioridad: headers.indexOf('PRIORIDAD'),
                    lat: headers.indexOf('GEOMANCORDY'),
                    lng: headers.indexOf('GEOMANCORDX'),
                    estado: headers.indexOf('ESTADOORDEN'),
                    observacion: headers.indexOf('OBSERVACION'),
                    servicios: headers.indexOf('NOMBREPRODUCTO'),
                    movil_elegido: headers.indexOf('MOVIL_ELEGIDO'),
                    demora: headers.indexOf('DEMORA_PENDIENTE'),
                    reagendos: headers.indexOf('ORDENAGENDANRO'),
                    telefono: headers.indexOf('TELEFONO')
                };

                const rowRegex = new RegExp(`${separador}(?=(?:(?:[^"]*"){2})*[^"]*$)`);

                for (let j = 1; j < lines.length; j++) {
                    if (!lines[j].trim()) continue;
                    const values = lines[j].split(rowRegex).map(v => v.replace(/^"|"$/g, '').trim());

                    if (idx.id === -1 || !values[idx.id]) continue;

                    let tipoFormateado = values[idx.tipo] || 'DESCONOCIDO';
                    if (tipoFormateado.includes('RECLAMO')) tipoFormateado = 'RECLAMO';
                    else if (tipoFormateado.includes('INSTALACION')) tipoFormateado = 'INSTALACION';
                    else if (tipoFormateado.includes('DESCONEXION')) tipoFormateado = 'DESCONEXION';

                    let prioridadFormateada = values[idx.prioridad] || '4-BAJA';
                    if (prioridadFormateada.includes('1')) prioridadFormateada = '1-CRÍTICA';
                    else if (prioridadFormateada.includes('2')) prioridadFormateada = '2-ALTA';
                    else if (prioridadFormateada.includes('3')) prioridadFormateada = '3-MEDIA';
                    else prioridadFormateada = '4-BAJA';

                    const latStr = (values[idx.lat] || '').replace(',', '.');
                    const lngStr = (values[idx.lng] || '').replace(',', '.');
                    const latParsed = parseFloat(latStr);
                    const lngParsed = parseFloat(lngStr);

                    const rawData = {};
                    headers.forEach((h, index) => {
                        if (values[index] && values[index].trim() !== '') {
                            rawData[h] = values[index];
                        }
                    });

                    const task = {
                        id: values[idx.id],
                        nroCliente: values[idx.nroCliente] || '',
                        tipo: tipoFormateado,
                        cliente: values[idx.cliente] || 'CLIENTE SIN NOMBRE',
                        direccion: `${values[idx.calle] || ''} ${values[idx.puerta] || ''}, ${values[idx.localidad] || 'ALTA GRACIA'}`.trim(),
                        fechaIngreso: values[idx.fechaIngreso]?.split(' ')[0] || '',
                        fechaReclamo: values[idx.fechaReclamo]?.split(' ')[0] || '',
                        prioridad: prioridadFormateada,
                        lat: isNaN(latParsed) ? -31.6529 : latParsed,
                        lng: isNaN(lngParsed) ? -64.4283 : lngParsed,
                        estado: 'PENDIENTE',
                        observacion: values[idx.observacion] || '',
                        servicios: values[idx.servicios] || '',
                        telefono: idx.telefono !== -1 ? values[idx.telefono] || '' : '',
                        demora: idx.demora !== -1 ? parseInt(values[idx.demora]) || 0 : 0,
                        reagendos: idx.reagendos !== -1 ? parseInt(values[idx.reagendos]) || 0 : 0,
                        movil: (idx.movil_elegido !== -1 && values[idx.movil_elegido]) ? values[idx.movil_elegido] : 'SIN ASIGNAR',
                        rawData: rawData
                    };

                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tareas', task.id), task);
                }
            }
        } catch (err) {
            console.error("Error importando:", err);
            alert("Hubo un error procesando el archivo CSV.");
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const pendingTasksForMap = useMemo(() => {
        return filteredAndSortedTasks.filter(t => t.estado !== 'FINALIZADA');
    }, [filteredAndSortedTasks]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full animate-in fade-in">
            {isImporting && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-white animate-spin mb-4" />
                    <h2 className="text-2xl font-bold text-white">Importando base de datos...</h2>
                    <p className="text-indigo-200 mt-2">Por favor no cierres esta ventana.</p>
                </div>
            )}

            <header className="bg-indigo-700 text-white shadow-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Monitor className="w-8 h-8 text-indigo-200" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Centro de Coordinación</h1>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center justify-center sm:justify-end text-sm font-medium">
                        <span className={`px-3 py-2 rounded-lg flex items-center gap-2 border ${syncStatus === 'En línea' ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100' : 'bg-slate-500/20 border-slate-400/30'}`}>
                            {syncStatus === 'En línea' ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                            <span className="hidden sm:inline">{syncStatus}</span>
                        </span>

                        <input type="file" accept=".csv" multiple className="hidden" ref={fileInputRef} onChange={handleImportCSV} />

                        <button onClick={() => fileInputRef.current.click()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-emerald-400 transition-colors shadow-sm" title="Subir tus propios archivos CSV">
                            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Cargar CSV</span>
                        </button>
                        <button onClick={handleExportCSV} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-indigo-400 transition-colors shadow-sm">
                            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
                        </button>
                        <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
                            <LogOut className="w-4 h-4" /> Salir
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-2/3 flex flex-col gap-4">
                    <div className="flex gap-2 border-b border-slate-300 overflow-x-auto no-scrollbar">
                        {[{ id: 'TODOS', label: 'TODAS LAS TAREAS' }, { id: 'RECLAMO', label: 'RECLAMOS' }, { id: 'INSTALACION', label: 'INSTALACIONES' }, { id: 'DESCONEXION', label: 'DESCONEXIONES' }].map(tab => {
                            const count = tab.id === 'TODOS' ? tasks.length : tasks.filter(t => t.tipo === tab.id).length;
                            return (
                                <button key={tab.id} onClick={() => setFilterTipo(tab.id)} className={`px-4 py-3 font-bold text-sm uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${filterTipo === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
                                    {tab.label} <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold shadow-sm ${filterTipo === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="w-5 h-5 text-slate-500" />
                            <select className="bg-slate-50 border border-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5" value={filterMovil} onChange={(e) => setFilterMovil(e.target.value)}>
                                <option value="TODOS">Todos los móviles</option>
                                {moviles.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Clock className="w-5 h-5 text-slate-500" />
                            <select className="bg-slate-50 border border-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                <option value="asc">Más antiguos primero</option>
                                <option value="desc">Más recientes primero</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {filteredAndSortedTasks.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500 flex flex-col items-center">
                                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                                <p className="text-lg font-medium text-slate-700">No hay tareas para mostrar.</p>
                                <p className="text-sm mt-1">Usa el botón "Cargar CSV" arriba para importar tu base de datos completa.</p>
                            </div>
                        ) : (
                            filteredAndSortedTasks.map((task, index) => (
                                <React.Fragment key={task.id}>
                                    <div className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 transition-all ${selectedMapTask?.id === task.id ? 'ring-2 ring-indigo-500' : ''}`}>
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-bold px-2 py-1 bg-slate-800 text-white rounded-md tracking-wider">{task.tipo}</span>
                                                    <span className="text-sm font-medium text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Cliente: {task.nroCliente}</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><User className="w-5 h-5 text-slate-400" />{task.cliente}</h3>
                                                <div className="mt-2 space-y-2">
                                                    <p className="text-sm text-slate-600 flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /><span>{task.direccion}</span></p>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <p className="text-sm text-slate-600 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400 shrink-0" /><span>Ingreso: <strong>{task.fechaReclamo}</strong></span></p>
                                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold ${task.demora > 5 ? 'bg-red-100 text-red-700 border border-red-200' : task.demora > 0 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`} title="Días de demora">
                                                            <Clock className="w-3.5 h-3.5" /> {task.demora || 0} Días de demora
                                                        </span>
                                                    </div>
                                                </div>
                                                <button onClick={() => setSelectedMapTask(task)} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors w-fit">
                                                    <MapPin className="w-4 h-4" /> Ver en mapa individual
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-3 w-full md:w-56 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Prioridad</label>
                                                    <select value={task.prioridad} onChange={(e) => onUpdateTask(task.id, 'prioridad', e.target.value)} className={`w-full text-sm font-medium border-0 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 ${getPriorityColor(task.prioridad)}`}>
                                                        {prioridades.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Móvil Asignado</label>
                                                    <div className="relative">
                                                        <select value={task.movil} onChange={(e) => onUpdateTask(task.id, 'movil', e.target.value)} className={`w-full text-sm border-0 rounded-md p-2 pl-8 focus:ring-2 focus:ring-indigo-500 ${getMovilColor(task.movil)}`}>
                                                            {moviles.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <Truck className={`w-4 h-4 absolute left-2 top-2.5 ${task.movil === 'SIN ASIGNAR' ? 'text-slate-400' : 'text-emerald-600'}`} />
                                                    </div>
                                                </div>
                                                <div className="mt-auto pt-2 border-t border-slate-200">
                                                    {task.estado === 'FINALIZADA' ? (
                                                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end"><CheckCircle className="w-4 h-4" /> FINALIZADA</span>
                                                    ) : task.estado === 'EN CURSO' ? (
                                                        <span className="text-xs text-blue-600 font-bold flex items-center gap-1 justify-end animate-pulse"><Play className="w-4 h-4" fill="currentColor" /> EN CURSO</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-500 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> PENDIENTE</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {index < filteredAndSortedTasks.length - 1 && (
                                        <div className="flex items-center gap-4 px-4 my-1">
                                            <div className="flex-1 h-px bg-slate-300"></div>
                                            <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                            <div className="flex-1 h-px bg-slate-300"></div>
                                        </div>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </div>
                </div>

                <div className="w-full lg:w-1/3">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-24">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><MapIcon className="w-5 h-5 text-indigo-600" />Localización Específica</h2>
                        {selectedMapTask ? (
                            <div className="flex flex-col gap-3">
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                    <p className="text-sm font-bold text-indigo-900">{selectedMapTask.cliente}</p>
                                    <p className="text-xs text-indigo-700 mt-1">{selectedMapTask.direccion}</p>
                                </div>
                                <div className="w-full h-80 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 relative">
                                    <iframe title="mapa" src={`https://maps.google.com/maps?q=${selectedMapTask.lat},${selectedMapTask.lng}&hl=es&z=15&output=embed`} width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-80 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                                <MapPin className="w-10 h-10 mb-2 opacity-50" />
                                <p className="text-sm text-center px-4">Selecciona "Ver en mapa individual" para ubicar un cliente aquí.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <section className="max-w-7xl mx-auto px-4 pb-12 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 sm:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <MapIcon className="w-6 h-6 text-indigo-600" />
                                Mapa Global de Tareas
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Mostrando {pendingTasksForMap.length} puntos en {filterTipo === 'TODOS' ? 'General' : filterTipo}. Navega para explorar.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-slate-400 shadow-sm border-2 border-white"></span> Sin Asignar</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm border-2 border-white"></span> Asignadas</div>
                            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm border-2 border-white animate-pulse"></span> En Curso</div>
                        </div>
                    </div>

                    <div className="w-full h-[450px] sm:h-[600px] bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-300 relative z-0">
                        <iframe title="Mapa General" srcDoc={generateMapHTML(pendingTasksForMap)} className="w-full h-full border-none"></iframe>
                        {pendingTasksForMap.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm z-10">
                                <p className="text-slate-500 font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">No hay tareas pendientes en este filtro para mostrar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

// ==========================================
// VISTA: APLICACIÓN MÓVIL DEL TÉCNICO
// ==========================================
function TecnicoDashboard({ tasks, onUpdateTask, onLogout }) {
    const [miMovil, setMiMovil] = useState(null);
    const [selectedMovilAuth, setSelectedMovilAuth] = useState(null);
    const [movilPasswordInput, setMovilPasswordInput] = useState('');
    const [movilLoginError, setMovilLoginError] = useState(false);
    const [taskToConfirm, setTaskToConfirm] = useState(null);
    const [resolucionTexto, setResolucionTexto] = useState("");
    const [expandedObs, setExpandedObs] = useState({});
    const [expandedServicios, setExpandedServicios] = useState({});
    const [expandedContacto, setExpandedContacto] = useState({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const toggleObservacion = (id) => setExpandedObs(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleServicios = (id) => setExpandedServicios(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleContacto = (id) => setExpandedContacto(prev => ({ ...prev, [id]: !prev[id] }));

    const misTareas = useMemo(() => {
        if (!miMovil) return [];
        let filtradas = tasks.filter(task => task.movil === miMovil && task.estado !== 'FINALIZADA');
        filtradas.sort((a, b) => {
            const pW = { '1-CRÍTICA': 1, '2-ALTA': 2, '3-MEDIA': 3, '4-BAJA': 4 };
            if (pW[a.prioridad] !== pW[b.prioridad]) return (pW[a.prioridad] || 5) - (pW[b.prioridad] || 5);
            return new Date(a.fechaReclamo).getTime() - new Date(b.fechaReclamo).getTime();
        });
        return filtradas;
    }, [tasks, miMovil]);

    const completedTasks = useMemo(() => {
        return tasks.filter(task => task.movil === miMovil && task.estado === 'FINALIZADA');
    }, [tasks, miMovil]);

    const getPriorityBadge = (prioridad) => {
        if (prioridad.includes('1-')) return 'bg-red-600 text-white animate-pulse shadow-red-200';
        if (prioridad.includes('2-')) return 'bg-orange-500 text-white shadow-orange-200';
        if (prioridad.includes('3-')) return 'bg-blue-500 text-white shadow-blue-200';
        return 'bg-slate-500 text-white shadow-slate-200';
    };

    const handleGeneratePDF = () => {
        if (completedTasks.length === 0) {
            alert("Aún no tienes tareas finalizadas en este turno para generar el reporte.");
            return;
        }

        setIsGeneratingPDF(true);
        const generateRealPDF = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59);
            doc.text("Reporte de Turno", 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100, 116, 139);
            doc.text(`Móvil Asignado: ${miMovil}`, 14, 32);
            doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 14, 38);
            doc.text(`Total Completadas: ${completedTasks.length} Tareas`, 14, 44);
            const tableColumn = ["N° Abonado", "Apellido y Nombre", "Direccion", "Resolucion"];
            const tableRows = completedTasks.map(t => [t.nroCliente, t.cliente, t.direccion, t.resolucionTecnico ? t.resolucionTecnico : 'Sin detalles']);
            doc.autoTable({
                startY: 50,
                head: [tableColumn],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] },
                styles: { fontSize: 9, cellPadding: 4 },
                columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 40 }, 2: { cellWidth: 60 }, 3: { cellWidth: 'auto' } }
            });
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text(`Centro Operativo Alta Gracia - Generado por Sistema Gestor de Tareas`, 14, doc.internal.pageSize.height - 20);
            const fileName = `Reporte_${miMovil.replace(' ', '_')}_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`;
            doc.save(fileName);
            setIsGeneratingPDF(false);
        };

        if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) {
            generateRealPDF();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const scriptTable = document.createElement('script');
                scriptTable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
                scriptTable.onload = () => { generateRealPDF(); };
                document.body.appendChild(scriptTable);
            };
            document.body.appendChild(script);
        }
    };

    if (!miMovil) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 animate-in fade-in w-full max-w-md mx-auto relative">
                <div className="w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100 relative">
                    <button onClick={onLogout} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors border border-transparent hover:border-red-100">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 mt-2">
                        <Truck className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Mi Turno</h1>
                    <p className="text-slate-500 mb-8 text-sm">Selecciona en qué móvil estás operando hoy.</p>
                    <div className="grid grid-cols-1 gap-3">
                        {moviles.filter(m => m !== 'SIN ASIGNAR').map(movil => (
                            <button key={movil} onClick={() => setSelectedMovilAuth(movil)} className="w-full py-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-bold text-lg rounded-2xl transition-all shadow-sm flex justify-between items-center px-6">
                                <span>{movil}</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                        ))}
                    </div>
                </div>

                {selectedMovilAuth && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
                            <button onClick={() => { setSelectedMovilAuth(null); setMovilLoginError(false); setMovilPasswordInput(''); }} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Acceso {selectedMovilAuth}</h2>
                            <p className="text-center text-slate-500 text-sm mb-6">Ingresa tu clave asignada para iniciar el turno.</p>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const validPassword = contraseñasMoviles[selectedMovilAuth] || '1234';
                                if (movilPasswordInput === validPassword) {
                                    setMiMovil(selectedMovilAuth);
                                    setSelectedMovilAuth(null);
                                    setMovilLoginError(false);
                                    setMovilPasswordInput('');
                                } else {
                                    setMovilLoginError(true);
                                }
                            }}>
                                <div className="mb-4">
                                    <input type="password" placeholder="Contraseña del móvil" value={movilPasswordInput} onChange={(e) => { setMovilPasswordInput(e.target.value); setMovilLoginError(false); }} className={`w-full p-4 border rounded-2xl outline-none focus:ring-2 transition-all text-center tracking-widest ${movilLoginError ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-slate-300 focus:ring-emerald-200 focus:border-emerald-500'}`} autoFocus />
                                    {movilLoginError && <p className="text-red-500 text-xs font-bold mt-2 ml-1 text-center animate-pulse">Clave incorrecta.</p>}
                                </div>
                                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-md">Ingresar</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 font-sans pb-32 w-full max-w-md mx-auto shadow-2xl relative animate-in slide-in-from-right print:hidden">
            <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-20 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl"><Truck className="w-5 h-5 text-indigo-600" /></div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-none">{miMovil}</h1>
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> En línea
                        </span>
                    </div>
                </div>
                <button onClick={() => setMiMovil(null)} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-200 rounded-full transition-colors"><LogOut className="w-5 h-5" /></button>
            </header>

            <main className="p-4 flex flex-col gap-4 mt-2">
                {misTareas.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 mb-2">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MapIcon className="w-5 h-5 text-indigo-600" /> Mi Hoja de Ruta</h2>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{misTareas.length} destinos</span>
                        </div>
                        <div className="w-full h-64 bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative z-0">
                            <iframe title="Mapa Ruta Técnico" srcDoc={generateMapHTML(misTareas)} className="w-full h-full border-none"></iframe>
                        </div>
                    </div>
                )}

                {misTareas.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-200 mt-10">
                        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800 mb-2">¡Todo al día!</h2>
                        <p className="text-slate-500 text-sm">No tienes tareas asignadas o ya finalizaste todas.</p>
                    </div>
                ) : (
                    misTareas.map((task) => (
                        <div key={task.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all duration-300 ${task.estado === 'EN CURSO' ? 'border-blue-400 shadow-blue-100 shadow-md ring-2 ring-blue-400 ring-offset-2' : 'border-slate-200'}`}>
                            <div className={`px-4 py-2.5 flex justify-between items-center shadow-sm ${getPriorityBadge(task.prioridad)}`}>
                                <span className="font-bold text-sm tracking-wide">{task.tipo}</span>
                                <span className="text-xs font-bold uppercase bg-black/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">{task.prioridad}</span>
                            </div>
                            <div className="p-5">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3"><User className="w-5 h-5 text-slate-400 shrink-0" /> {task.cliente}</h3>
                                <div className="space-y-3 mb-5">
                                    <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${task.estado === 'EN CURSO' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <MapPin className={`w-5 h-5 mt-0.5 shrink-0 ${task.estado === 'EN CURSO' ? 'text-blue-500' : 'text-indigo-500'}`} />
                                        <p className="text-sm font-medium text-slate-700 leading-tight">{task.direccion}</p>
                                    </div>
                                    <div className="flex justify-between items-center px-1 flex-wrap gap-2 mt-2">
                                        <p className="text-xs text-slate-500 flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Cliente: {task.nroCliente}</p>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Ingreso: {task.fechaReclamo}</p>
                                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${task.demora > 5 ? 'bg-red-100 text-red-700 border border-red-200' : task.demora > 0 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}><Clock className="w-3 h-3" /> {task.demora || 0} Días</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <button onClick={() => toggleContacto(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedContacto[task.id] ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 hover:bg-blue-50/50 text-slate-600 border-slate-200'}`}>
                                        <div className="flex items-center gap-2"><PhoneCall className="w-4 h-4" /><span className="text-sm font-semibold">Contacto del Cliente</span></div>
                                        {expandedContacto[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedContacto[task.id] && (
                                        <div className="p-4 mt-2 bg-blue-50/50 border border-blue-100 rounded-xl shadow-inner animate-in slide-in-from-top-2">
                                            {task.telefono && task.telefono.trim() !== '' ? (
                                                <div className="flex flex-col gap-3">
                                                    <p className="text-sm font-bold text-slate-800 text-center">{task.telefono}</p>
                                                    <div className="flex gap-2">
                                                        <a href={`tel:${task.telefono.replace(/[^0-9+]/g, '')}`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors shadow-sm text-sm"><PhoneCall className="w-4 h-4" /> Llamar</a>
                                                        <a href={`https://wa.me/549${task.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors shadow-sm text-sm"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
                                                    </div>
                                                </div>
                                            ) : <p className="text-sm text-slate-500 italic text-center py-2">Sin número registrado.</p>}
                                        </div>
                                    )}
                                </div>

                                {task.servicios && (
                                    <div className="mb-2">
                                        <button onClick={() => toggleServicios(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedServicios[task.id] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 hover:bg-emerald-50/50 text-slate-600 border-slate-200'}`}>
                                            <div className="flex items-center gap-2"><Package className="w-4 h-4" /><span className="text-sm font-semibold">Servicios Contratados</span></div>
                                            {expandedServicios[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        {expandedServicios[task.id] && <div className="p-4 mt-2 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-inner text-sm font-medium text-emerald-900 whitespace-pre-wrap">{task.servicios}</div>}
                                    </div>
                                )}

                                {task.observacion && (
                                    <div className="mb-4">
                                        <button onClick={() => toggleObservacion(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedObs[task.id] ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 hover:bg-indigo-50/50 text-slate-600 border-slate-200'}`}>
                                            <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span className="text-sm font-semibold">Observaciones</span></div>
                                            {expandedObs[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        {expandedObs[task.id] && <div className="p-4 mt-2 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-inner text-sm text-slate-700 whitespace-pre-wrap">{task.observacion}</div>}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 mt-4 border-t border-slate-100 pt-4">
                                    {taskToConfirm === task.id ? (
                                        <div className="col-span-2 flex flex-col gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in">
                                            <label className="text-sm font-semibold text-slate-700">Resolución:</label>
                                            <textarea className="w-full p-3 rounded-xl border border-slate-300 text-sm outline-none resize-none" rows="3" placeholder="Detalle del trabajo..." value={resolucionTexto} onChange={(e) => setResolucionTexto(e.target.value)}></textarea>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => { setTaskToConfirm(null); setResolucionTexto(''); }} className="flex-1 bg-slate-200 text-slate-600 rounded-xl py-2.5 font-bold text-sm">Cancelar</button>
                                                <button onClick={() => { onUpdateTask(task.id, { estado: 'FINALIZADA', resolucionTecnico: resolucionTexto }); setTaskToConfirm(null); setResolucionTexto(''); }} className="flex-1 bg-emerald-500 text-white rounded-xl py-2.5 font-bold text-sm shadow-md">Confirmar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <React.Fragment>
                                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-700 font-semibold py-3.5 rounded-2xl border border-slate-200"><Navigation className="w-5 h-5" /> <span className="text-sm">Navegar</span></a>
                                            {task.estado !== 'EN CURSO' ? (
                                                <button onClick={() => onUpdateTask(task.id, 'estado', 'EN CURSO')} className="flex flex-col items-center justify-center gap-1.5 bg-blue-50 text-blue-700 font-semibold py-3.5 rounded-2xl border border-blue-200"><Play className="w-5 h-5" fill="currentColor" /> <span className="text-sm">Comenzar</span></button>
                                            ) : (
                                                <button onClick={() => { setTaskToConfirm(task.id); setResolucionTexto(''); }} className="flex-col items-center justify-center gap-1.5 bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl shadow-md flex"><CheckCircle className="w-5 h-5" /> <span className="text-sm">Finalizar</span></button>
                                            )}
                                        </React.Fragment>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                <div className="mt-6 mb-4">
                    <div className="bg-slate-800 rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
                        <h3 className="text-white font-bold text-lg mb-1 relative z-10">Cierre de Turno</h3>
                        <p className="text-slate-300 text-sm mb-5 relative z-10">Reporte con {completedTasks.length} tareas.</p>
                        <button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md relative z-10 ${isGeneratingPDF ? 'bg-indigo-400 text-indigo-100 cursor-not-allowed' : 'bg-indigo-500 text-white'}`}>
                            {isGeneratingPDF ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando...</> : <><FileText className="w-5 h-5" /> Descargar Reporte PDF</>}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ==========================================
// COMPONENTE PRINCIPAL (LOGIN / FIREBASE)
// ==========================================
export default function App() {
    const [tasks, setTasks] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState('Conectando...');
    const [appRole, setAppRole] = useState(null);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [loginError, setLoginError] = useState(false);

    useEffect(() => {
        const initAuth = async () => {
            try {
                await signInAnonymously(auth);
            } catch (err) {
                console.error("Auth Error:", err);
                setSyncStatus('Error');
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        setSyncStatus('Sincronizando...');
        const tasksCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tareas');
        const unsubscribe = onSnapshot(tasksCollection,
            (snapshot) => {
                if (snapshot.empty) {
                    mockData.forEach(async (task) => {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tareas', task.id), task);
                    });
                } else {
                    setTasks(snapshot.docs.map(doc => doc.data()));
                }
                setLoading(false);
                setSyncStatus('En línea');
            },
            (error) => {
                setSyncStatus('Desconectado');
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user]);

    const handleUpdateTask = async (id, fieldOrUpdates, value) => {
        if (!user) return;
        let updates = {};
        if (typeof fieldOrUpdates === 'object') updates = fieldOrUpdates;
        else updates[fieldOrUpdates] = value;

        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tareas', id), updates);
        } catch (error) {
            console.error("Update Error:", error);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-700">Conectando...</h2>
        </div>
    );

    if (!appRole) return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <div className="text-center mb-10">
                <MapIcon className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-white mb-2">Sistema Gestor de Tareas</h1>
                <p className="text-slate-400">Selecciona tu perfil de ingreso</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
                <button onClick={() => setShowAdminLogin(true)} className="flex-1 bg-white p-8 rounded-3xl hover:bg-indigo-50 border-4 border-transparent hover:border-indigo-500 transition-all text-center group">
                    <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Lock className="w-10 h-10 text-indigo-600" /></div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Coordinador</h2>
                    <p className="text-sm text-slate-500">Gestión total y mapa general.</p>
                </button>
                <button onClick={() => setAppRole('TECNICO')} className="flex-1 bg-white p-8 rounded-3xl hover:bg-emerald-50 border-4 border-transparent hover:border-emerald-500 transition-all text-center group">
                    <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Smartphone className="w-10 h-10 text-emerald-600" /></div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Técnico Móvil</h2>
                    <p className="text-sm text-slate-500">Hojas de ruta y tareas diarias.</p>
                </button>
            </div>

            {showAdminLogin && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
                        <button onClick={() => { setShowAdminLogin(false); setLoginError(false); setAdminPassword(''); }} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"><Monitor className="w-8 h-8 text-indigo-600" /></div>
                        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Acceso Coordinador</h2>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (adminPassword === 'admin123') { setAppRole('ADMIN'); setShowAdminLogin(false); setLoginError(false); setAdminPassword(''); }
                            else { setLoginError(true); }
                        }}>
                            <div className="mb-4">
                                <input type="password" placeholder="Contraseña" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setLoginError(false); }} className={`w-full p-4 border rounded-2xl outline-none focus:ring-2 transition-all ${loginError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200'}`} autoFocus />
                                {loginError && <p className="text-red-500 text-xs font-bold mt-2 ml-1 animate-pulse text-center">Clave incorrecta.</p>}
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-md">Ingresar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    if (appRole === 'ADMIN') return <AdminDashboard tasks={tasks} onUpdateTask={handleUpdateTask} syncStatus={syncStatus} onLogout={() => setAppRole(null)} />;
    if (appRole === 'TECNICO') return <TecnicoDashboard tasks={tasks} onUpdateTask={handleUpdateTask} onLogout={() => setAppRole(null)} />;
    return null;
}
