import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MapPin, Calendar, AlertCircle, Truck, Filter, Map as MapIcon,
  Clock, User, Hash, CheckCircle, Download, Cloud, CloudOff,
  Loader2, Navigation, LogOut, Monitor, Smartphone, ChevronRight,
  Play, ChevronDown, ChevronUp, FileText, Package, X, Upload,
  Printer, RefreshCw, PhoneCall, MessageCircle, Lock, KeyRound, Trash2, Settings, Camera, UserX,
  ClipboardCheck, List, ArrowLeft, Gauge, Fuel, BookOpen, Wifi, QrCode, Type, Pencil, Archive, FolderOpen, Image as ImageIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';

// --- 1. CONFIGURACIÓN FIREBASE ---

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializamos la app con el objeto que tiene tus datos
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Para tu ID de aplicación personalizada
const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

const prioridades = ['1-CRÍTICA', '2-ALTA', '3-MEDIA', '4-BAJA'];

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
const generateMapHTML = (tasks, drawRoute = false, movilesList = ['MÓVIL 1', 'MÓVIL 2', 'MÓVIL 3', 'MÓVIL 4'], isTechnician = false) => {
  const allMoviles = ['SIN ASIGNAR', ...movilesList];

  const markers = tasks.map(t => {
    let color = '#94a3b8'; // gris
    let extraCss = '';

    if (t.estado === 'FINALIZADA') {
      color = '#3b82f6'; // azul
    } else if (t.estado === 'EN CURSO') {
      color = '#eab308'; // amarillo
      extraCss = 'animation: pulseMap 1.5s infinite;';
    } else if (t.movil !== 'SIN ASIGNAR') {
      color = '#10b981'; // verde
    }

    const movilMatch = t.movil.match(/\d+/);
    const movilNum = movilMatch ? movilMatch[0] : '';

    const iconHtml = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; font-family: sans-serif; line-height: 1; ${extraCss}">${movilNum}</div>`;
    const cliente = (t.cliente || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');
    const direccion = (t.direccion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');

    if (isNaN(t.lat) || isNaN(t.lng) || t.lat === 0 || t.lng === 0) return '';

    const movilesOptions = allMoviles.map(m =>
      `<option value="${m}" ${t.movil === m ? 'selected' : ''}>${m}</option>`
    ).join('');

    const popupHtmlRaw = `
      <div style="font-family: sans-serif; width: 200px;">
        <strong style="font-size: 14px;">${cliente}</strong><br/>
        <span style="color: #4f46e5; font-weight: bold;">${t.tipo}</span> • <span style="color: #64748b;">${t.movil}</span><br/>
        <span style="color: #64748b; font-size: 12px; display: inline-block; margin-top: 4px;">${direccion}</span>
        <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          ${isTechnician ? `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}" target="_blank" style="display: block; width: 100%; background: #4f46e5; color: white; text-decoration: none; text-align: center; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: bold; box-sizing: border-box;">Ir hacia el lugar</a>
          ` : `
            <label style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Asignar a móvil:</label>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <select id="sel-${t.id}" style="flex: 1; padding: 4px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; outline: none;">
                ${movilesOptions}
              </select>
              <button onclick="window.parent.postMessage({ type: 'ASSIGN_TASK', taskId: '${t.id}', movil: document.getElementById('sel-${t.id}').value }, '*')" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">OK</button>
            </div>
          `}
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

  let routeScript = '';
  if (drawRoute && validTasks.length > 0) {
    routeScript = `
      var routePoints = [
        [-31.656228, -64.433808], // Punto de partida (Centro)
        ${validTasks.map(t => `[${t.lat}, ${t.lng}]`).join(',')}
      ];
      L.polyline(routePoints, {
        color: '#4f46e5', // Indigo-600
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8',
        lineJoin: 'round'
      }).addTo(map);

      // Marcador especial para el centro
      L.marker([-31.656228, -64.433808], {
        icon: L.divIcon({ 
          html: '<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>', 
          className: '', 
          iconSize: [20, 20], 
          iconAnchor: [10, 10] 
        })
      }).bindPopup('<div style="font-family: sans-serif; font-size: 14px; font-weight: bold; color: #ef4444;">Centro de Alta Gracia</div><div style="font-size:12px; color:#64748b;">Punto de partida del recorrido</div>').addTo(map);
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.min.js"></script>
      <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #f8fafc; }
        #map { width: 100vw; height: 100vh; }
        @keyframes pulseMap {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
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
        ${routeScript}
        
        // Agregar controles de dibujo (Geoman)
        map.pm.setLang('es');
        map.pm.addControls({
          position: 'topleft',
          drawMarker: false,
          drawCircleMarker: false,
          drawPolyline: false,
          drawText: false,
          editMode: false,
          dragMode: false,
          cutPolygon: false,
          removalMode: false,
          rotateMode: false
        });

        // Configuración para el chequeo de áreas
        var allTasks = [
          ${validTasks.map(t => `{ id: '${t.id}', lat: ${t.lat}, lng: ${t.lng} }`).join(',\n')}
        ];

        map.on('pm:create', function(e) {
          var layer = e.layer;
          var shape = e.shape; 
          var selectedIds = [];

          if (shape === 'Circle') {
            var center = layer.getLatLng();
            var radius = layer.getRadius();
            allTasks.forEach(function(task) {
              if (center.distanceTo(L.latLng(task.lat, task.lng)) <= radius) {
                selectedIds.push(task.id);
              }
            });
          } else if (shape === 'Polygon' || shape === 'Rectangle') {
            var polygonGeoJSON = layer.toGeoJSON();
            allTasks.forEach(function(task) {
              var pt = turf.point([task.lng, task.lat]);
              if (turf.booleanPointInPolygon(pt, polygonGeoJSON)) {
                selectedIds.push(task.id);
              }
            });
          }

          // Eliminamos la figura inmediatamente después de capturar los datos
          map.removeLayer(layer);

          if (selectedIds.length > 0) {
            window.parent.postMessage({ type: 'BULK_SELECT_TASKS', taskIds: selectedIds }, '*');
          } else {
            window.parent.postMessage({ type: 'BULK_SELECT_EMPTY' }, '*');
          }
        });

        var bounds = [];
        ${drawRoute ? `bounds.push([-31.656228, -64.433808]);` : ''}
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
function AdminDashboard({ tasks, onUpdateTask, syncStatus, onLogout, isTimeTrackingEnabled, movilesList, adminTitle, onSaveForm }) {
  const [filterMovil, setFilterMovil] = useState('TODOS');
  const [filterTipo, setFilterTipo] = useState('RECLAMO');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedMapTask, setSelectedMapTask] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearType, setClearType] = useState('ALL');
  const [isClearing, setIsClearing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const allMoviles = ['SIN ASIGNAR', ...movilesList];

  // Estados para Asignación Masiva
  const [bulkSelectedTasks, setBulkSelectedTasks] = useState([]);
  const [bulkAssignMovil, setBulkAssignMovil] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data) {
        if (event.data.type === 'ASSIGN_TASK') {
          onUpdateTask(event.data.taskId, 'movil', event.data.movil);
        } else if (event.data.type === 'BULK_SELECT_TASKS') {
          setBulkSelectedTasks(event.data.taskIds);
          setBulkAssignMovil(movilesList.length > 0 ? movilesList[0] : 'SIN ASIGNAR');
        } else if (event.data.type === 'BULK_SELECT_EMPTY') {
          setToastMsg('El área dibujada no contiene ninguna tarea visible.');
          setTimeout(() => setToastMsg(''), 3000);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdateTask, movilesList]);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];
    if (filterMovil !== 'TODOS') result = result.filter(task => task.movil === filterMovil);

    if (filterTipo === 'FINALIZADAS') {
      result = result.filter(task => task.estado === 'FINALIZADA');
    } else if (filterTipo !== 'TODOS') {
      result = result.filter(task => task.tipo === filterTipo && task.estado !== 'FINALIZADA');
    }

    result.sort((a, b) => {
      if (sortOrder === 'geo') {
        const centerLat = -31.656228;
        const centerLng = -64.433808;
        const distA = Math.pow((a.lat || 0) - centerLat, 2) + Math.pow((a.lng || 0) - centerLng, 2);
        const distB = Math.pow((b.lat || 0) - centerLat, 2) + Math.pow((b.lng || 0) - centerLng, 2);
        return distA - distB;
      }

      const dateA = new Date(a.fechaReclamo).getTime();
      const dateB = new Date(b.fechaReclamo).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return result;
  }, [tasks, filterMovil, filterTipo, sortOrder]);

  const handleExportPDF = () => {
    if (tasks.length === 0) {
      alert("No hay tareas para exportar.");
      return;
    }

    setIsExportingPDF(true);

    const generateRealPDF = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text("Reporte General de Tareas y Flota", 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}`, 14, 32);
      doc.text(`Total de tareas registradas: ${tasks.length}`, 14, 38);

      const formatDuration = (start, end) => {
        if (!start || !end) return '-';
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return '< 1 min';
        if (diffMins < 60) return `${diffMins} min`;
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hrs}h ${mins}m`;
      };

      const tableColumn = isTimeTrackingEnabled
        ? ["Móvil Asignado", "N° Abonado", "Cliente", "Tipo Tarea", "Estado", "Tiempo", "Dirección"]
        : ["Móvil Asignado", "N° Abonado", "Cliente", "Tipo Tarea", "Estado", "Dirección"];

      const sortedTasks = [...tasks].sort((a, b) => {
        if (a.movil !== b.movil) return a.movil.localeCompare(b.movil);
        if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
        return a.estado.localeCompare(b.estado);
      });

      const tableRows = sortedTasks.map(t => {
        let estadoDisplay = t.estado;
        if (t.estado === 'PENDIENTE') {
          estadoDisplay = t.movil !== 'SIN ASIGNAR' ? 'ASIGNADA' : 'PENDIENTE';
        }

        const row = [
          t.movil,
          t.nroCliente,
          t.cliente,
          t.tipo,
          estadoDisplay
        ];

        if (isTimeTrackingEnabled) {
          row.push(formatDuration(t.horaInicio, t.horaFin));
        }

        row.push(t.direccion);
        return row;
      });

      doc.autoTable({
        startY: 44,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: isTimeTrackingEnabled ? {
          0: { fontStyle: 'bold', cellWidth: 32 },
          3: { cellWidth: 30 },
          4: { fontStyle: 'bold', cellWidth: 25 },
          5: { fontStyle: 'italic', cellWidth: 18 }
        } : {
          0: { fontStyle: 'bold', cellWidth: 32 },
          3: { cellWidth: 30 },
          4: { fontStyle: 'bold', cellWidth: 25 }
        }
      });

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Centro Operativo Alta Gracia - Generado por Sistema Gestor de Tareas`, 14, doc.internal.pageSize.height - 10);

      const fileName = `Reporte_General_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`;
      doc.save(fileName);

      // Guardar formulario
      onSaveForm('REPORTE GENERAL', 'Coordinador', {
        totalTareas: tasks.length
      });

      setIsExportingPDF(false);
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

  const handleImportCSV = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsImporting(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const cleanText = text.replace(/^\uFEFF/, '');
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

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const tasksToDelete = clearType === 'ALL'
        ? tasks
        : tasks.filter(t => t.tipo === clearType);

      for (const task of tasksToDelete) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tareas', task.id));
      }
      setShowClearConfirm(false);
      setClearType('ALL');
    } catch (error) {
      console.error("Error al limpiar la base de datos:", error);
    } finally {
      setIsClearing(false);
    }
  };

  const pendingTasksForMap = useMemo(() => {
    if (filterTipo === 'FINALIZADAS') return filteredAndSortedTasks;
    return filteredAndSortedTasks.filter(t => t.estado !== 'FINALIZADA');
  }, [filteredAndSortedTasks, filterTipo]);

  const handleGenerateAdminPDF = () => {
    try {
      const docPdf = new jsPDF();

      docPdf.setFillColor(79, 70, 229);
      docPdf.rect(0, 0, 210, 30, 'F');
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(16);
      docPdf.text('INFORME DE TAREAS FINALIZADAS', 15, 20);

      docPdf.setTextColor(40, 40, 40);
      docPdf.setFontSize(10);
      docPdf.text(`Generado el: ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}`, 15, 38);

      const porMovil = {};
      filteredAndSortedTasks.forEach(t => {
        if (!porMovil[t.movil]) porMovil[t.movil] = [];
        porMovil[t.movil].push(t);
      });

      let y = 50;

      Object.keys(porMovil).sort().forEach(movil => {
        if (y > 270) {
          docPdf.addPage();
          y = 20;
        }

        docPdf.setFillColor(240, 240, 240);
        docPdf.rect(15, y - 5, 180, 8, 'F');
        docPdf.setFontSize(12);
        docPdf.setTextColor(30, 30, 30);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(`Móvil: ${movil} (${porMovil[movil].length} tareas)`, 17, y);
        y += 8;

        docPdf.setFontSize(10);
        docPdf.setFont("helvetica", "normal");

        porMovil[movil].forEach(t => {
          if (y > 280) {
            docPdf.addPage();
            y = 20;
          }
          const text = `- [${t.tipo}] Cliente: ${t.cliente} | Nro: ${t.nroCliente}`;
          docPdf.text(text, 20, y);
          y += 5;
          if (t.resolucionTecnico) {
            docPdf.setTextColor(100, 100, 100);
            docPdf.setFontSize(9);
            const resLines = docPdf.splitTextToSize(`Res: ${t.resolucionTecnico.replace(/\n/g, ' ')}`, 170);
            docPdf.text(resLines, 25, y);
            y += (resLines.length * 4) + 2;
            docPdf.setTextColor(30, 30, 30);
            docPdf.setFontSize(10);
          }
        });
        y += 5;
      });

      docPdf.save(`Informe-Finalizadas-${Date.now()}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full animate-in fade-in relative">

      {/* Toast Notification para Asignación Masiva Vacía */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-5">
          {toastMsg}
        </div>
      )}

      {/* Modal de Asignación Masiva */}
      {bulkSelectedTasks.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center animate-in zoom-in-95">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Asignación Masiva</h3>
            <p className="text-sm text-slate-500 mb-6">
              ¿Asignar estas <span className="font-bold text-slate-700">{bulkSelectedTasks.length} tareas</span> seleccionadas en el mapa al siguiente móvil?
            </p>
            <select
              value={bulkAssignMovil || (movilesList.length > 0 ? movilesList[0] : 'SIN ASIGNAR')}
              onChange={(e) => setBulkAssignMovil(e.target.value)}
              className="w-full mb-6 p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-center"
            >
              {movilesList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="SIN ASIGNAR">Desasignar (SIN ASIGNAR)</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkSelectedTasks([])}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await Promise.all(bulkSelectedTasks.map(id => onUpdateTask(id, 'movil', bulkAssignMovil)));
                  setBulkSelectedTasks([]);
                  setToastMsg(`¡${bulkSelectedTasks.length} tareas asignadas con éxito!`);
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isImporting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-16 h-16 text-white animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-white">Importando base de datos...</h2>
          <p className="text-indigo-200 mt-2">Por favor no cierres esta ventana.</p>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center animate-in zoom-in-95">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Limpiar base de datos?</h3>
            <p className="text-sm text-slate-500 mb-4">Selecciona qué datos deseas eliminar. Esta acción no se puede deshacer.</p>

            <select
              value={clearType}
              onChange={(e) => setClearType(e.target.value)}
              className="w-full mb-6 p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 text-center"
            >
              <option value="ALL">Borrar Todo</option>
              <option value="RECLAMO">Borrar Solo Reclamos</option>
              <option value="INSTALACION">Borrar Solo Instalaciones</option>
              <option value="DESCONEXION">Borrar Solo Desconexiones</option>
            </select>

            <div className="flex gap-3">
              <button onClick={() => { setShowClearConfirm(false); setClearType('ALL'); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-xl font-bold transition-colors" disabled={isClearing}>Cancelar</button>
              <button onClick={handleClearDatabase} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors" disabled={isClearing}>
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#94288f] text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-indigo-200" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{adminTitle || 'Centro de Coordinación'}</h1>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-center sm:justify-end text-sm font-medium">
            <button onClick={() => setShowClearConfirm(true)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-red-400 transition-colors shadow-sm" title="Limpiar todos los datos">
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Limpiar CSV</span>
            </button>
            <input type="file" accept=".csv" multiple className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
            <button onClick={() => fileInputRef.current.click()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-emerald-400 transition-colors shadow-sm" title="Subir tus propios archivos CSV">
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Cargar CSV</span>
            </button>
            <button onClick={handleExportPDF} disabled={isExportingPDF} className={`px-3 py-2 rounded-lg flex items-center gap-2 border transition-colors shadow-sm ${isExportingPDF ? 'bg-indigo-400 border-indigo-300 text-indigo-100 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400'}`}>
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExportingPDF ? 'Generando...' : 'Exportar PDF'}</span>
            </button>
            <button onClick={onLogout} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
        <div className="bg-slate-50 w-full shadow-sm border-b border-slate-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-2/3 flex gap-2 overflow-x-auto no-scrollbar pt-2">
              {[{ id: 'RECLAMO', label: 'RECLAMOS' }, { id: 'INSTALACION', label: 'INSTALACIONES' }, { id: 'DESCONEXION', label: 'DESCONEXIONES' }, { id: 'FINALIZADAS', label: 'FINALIZADAS' }].map(tab => {
                const count = tab.id === 'FINALIZADAS'
                  ? tasks.filter(t => t.estado === 'FINALIZADA').length
                  : tasks.filter(t => t.tipo === tab.id && t.estado !== 'FINALIZADA').length;
                return (
                  <button key={tab.id} onClick={() => setFilterTipo(tab.id)} className={`px-4 py-3 font-bold text-sm uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${filterTipo === tab.id ? 'border-[#94288f] text-[#94288f]' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
                    {tab.label} <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold shadow-sm ${filterTipo === tab.id ? 'bg-[#94288f] text-white' : 'bg-slate-200 text-slate-700'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:block lg:w-1/3"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-2/3 flex flex-col gap-4">

          {/* MAPA GLOBAL DE TAREAS (MOVIDO DEBAJO DE LAS SOLAPAS) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-indigo-600" />
                  Mapa Global de Tareas
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Mostrando {pendingTasksForMap.length} puntos. Dibuja sobre el mapa para asignar tareas en lote.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400 shadow-sm border-2 border-white"></span> Sin Asignar</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm border-2 border-white"></span> Asignadas</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm border-2 border-white animate-pulse"></span> En Curso</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm border-2 border-white"></span> Finalizadas</div>
              </div>
            </div>
            <div className="w-full h-[400px] sm:h-[500px] bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-300 relative z-0">
              <iframe title="Mapa General" srcDoc={generateMapHTML(pendingTasksForMap, sortOrder === 'geo', movilesList, false)} className="w-full h-full border-none"></iframe>
              {pendingTasksForMap.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm z-10">
                  <p className="text-slate-500 font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">No hay tareas en este filtro para mostrar.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-5 h-5 text-slate-500" />
              <select className="bg-slate-50 border border-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5" value={filterMovil} onChange={(e) => setFilterMovil(e.target.value)}>
                <option value="TODOS">Todos los móviles</option>
                {allMoviles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Clock className="w-5 h-5 text-slate-500" />
              <select className="bg-slate-50 border border-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="asc">Más antiguos primero</option>
                <option value="desc">Más recientes primero</option>
                <option value="geo">Sugerencia de recorrido</option>
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
                          <p className="text-sm text-slate-600 flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <span className="flex flex-wrap items-center gap-2">
                              {task.direccion}
                              {(!task.lat || task.lat === -31.6529) && (
                                <span className="bg-red-50 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-tighter">
                                  Sin Geolocalización
                                </span>
                              )}
                            </span>
                          </p>
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
                              {allMoviles.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <Truck className={`w-4 h-4 absolute left-2 top-2.5 ${task.movil === 'SIN ASIGNAR' ? 'text-slate-400' : 'text-emerald-600'}`} />
                          </div>
                        </div>
                        <div className="mt-auto pt-2 border-t border-slate-200">
                          {task.estado === 'FINALIZADA' ? (
                            <span className="text-xs text-blue-600 font-bold flex items-center gap-1 justify-end"><CheckCircle className="w-4 h-4" /> FINALIZADA</span>
                          ) : task.estado === 'EN CURSO' ? (
                            <span className="text-xs text-yellow-600 font-bold flex items-center gap-1 justify-end animate-pulse"><Play className="w-4 h-4" fill="currentColor" /> EN CURSO</span>
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

            {filterTipo === 'FINALIZADAS' && filteredAndSortedTasks.length > 0 && (
              <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row justify-between items-center shadow-sm gap-4">
                <div className="text-center sm:text-left">
                  <h4 className="font-bold text-indigo-900">Descargar Informe</h4>
                  <p className="text-sm text-indigo-700">Genera un PDF con las {filteredAndSortedTasks.length} tareas finalizadas ordenadas por móvil.</p>
                </div>
                <button
                  onClick={handleGenerateAdminPDF}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 shrink-0"
                >
                  <Download className="w-5 h-5" /> Informe de finalizadas
                </button>
              </div>
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
    </div>
  );
}

// ==========================================
// VISTA: APLICACIÓN MÓVIL DEL TÉCNICO
// ==========================================
function TecnicoDashboard({ tasks, onUpdateTask, onLogout, movilPasswords, movilesList, resolucionOpciones, onSaveForm }) {
  const getInitialMovil = () => {
    try { return localStorage.getItem('miMovil') || null; } catch (e) { return null; }
  };
  const initialMovil = getInitialMovil();
  const [miMovil, setMiMovil] = useState(initialMovil);
  const [selectedMovilAuth, setSelectedMovilAuth] = useState(null);
  const [movilPasswordInput, setMovilPasswordInput] = useState('');
  const [movilLoginError, setMovilLoginError] = useState(false);

  const [techView, setTechView] = useState('menu');
  const [formVehiculo, setFormVehiculo] = useState(() => {
    if (!initialMovil) return { tecnico1: '', tecnico2: '', kmInicial: '', combustible: 'Medio (1/2)', observaciones: '' };
    try {
      const saved = localStorage.getItem(`formVehiculo_${initialMovil}`);
      return saved ? JSON.parse(saved) : { tecnico1: '', tecnico2: '', kmInicial: '', combustible: 'Medio (1/2)', observaciones: '' };
    } catch (e) {
      return { tecnico1: '', tecnico2: '', kmInicial: '', combustible: 'Medio (1/2)', observaciones: '' };
    }
  });
  const [isFormCompleted, setIsFormCompleted] = useState(() => {
    if (!initialMovil) return false;
    try { return localStorage.getItem(`isFormCompleted_${initialMovil}`) === 'true'; } catch (e) { return false; }
  });
  const [dropdownOpen, setDropdownOpen] = useState(null);

  const tecnicosList = ['ACEVEDO', 'ALLENDE', 'ANTONELLO', 'ARROYO', 'DIAZ', 'NAKASONE', 'PARISI', 'PERALTA', 'POWELL', 'RODRIGUEZ', 'SMITH'];

  const [taskToConfirm, setTaskToConfirm] = useState(null);
  const [resolucionTexto, setResolucionTexto] = useState("");
  const [quickSelectVal, setQuickSelectVal] = useState("");
  const [expandedObs, setExpandedObs] = useState({});
  const [expandedServicios, setExpandedServicios] = useState({});
  const [expandedContacto, setExpandedContacto] = useState({});
  const [expandedAusente, setExpandedAusente] = useState({});
  const [expandedProblema, setExpandedProblema] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [sortOrder, setSortOrder] = useState('prioridad');
  const [showCompletedList, setShowCompletedList] = useState(false);

  const [showKmFinalModal, setShowKmFinalModal] = useState(false);
  const [kmFinal, setKmFinal] = useState('');

  const [macInstalado, setMacInstalado] = useState('');
  const [macRetirado, setMacRetirado] = useState('');
  const [scanningField, setScanningField] = useState(null);
  const [compressingTaskId, setCompressingTaskId] = useState(null);

  const [textSizeMultiplier, setTextSizeMultiplier] = useState(1);

  const toggleObservacion = (id) => setExpandedObs(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleServicios = (id) => setExpandedServicios(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleContacto = (id) => setExpandedContacto(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAusente = (id) => setExpandedAusente(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleProblema = (id) => setExpandedProblema(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    let scanner = null;

    if (!window.imageCompression) {
      const scriptCompression = document.createElement('script');
      scriptCompression.src = "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js";
      document.head.appendChild(scriptCompression);
    }

    const initScanner = () => {
      if (window.Html5QrcodeScanner && scanningField) {
        document.getElementById('qr-reader').innerHTML = '';
        scanner = new window.Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 150 } },
          false
        );
        scanner.render(
          (decodedText) => {
            if (scanningField === 'instalado') setMacInstalado(decodedText);
            if (scanningField === 'retirado') setMacRetirado(decodedText);
            setScanningField(null);
          },
          (errorMessage) => { }
        );
      }
    };

    if (scanningField) {
      if (!window.Html5QrcodeScanner) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = initScanner;
        document.body.appendChild(script);
      } else {
        initScanner();
      }
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Error limpiando scanner", error));
      }
    };
  }, [scanningField]);

  const handleCameraCapture = async (event, task) => {
    const file = event.target.files[0];
    if (!file) return;

    setCompressingTaskId(task.id);
    let fileToShare = file;
    const mensaje = `*AUSENTE*\nCliente: ${task.cliente}\nNro Abonado: ${task.nroCliente}\nDirección: ${task.direccion}`;

    try {
      if (window.imageCompression) {
        const options = {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        };
        const compressedBlob = await window.imageCompression(file, options);
        fileToShare = new File([compressedBlob], file.name, { type: file.type });
      }
    } catch (error) {
      console.error("Error al comprimir la imagen:", error);
    } finally {
      setCompressingTaskId(null);
    }

    if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
      try {
        await navigator.share({
          files: [fileToShare],
          title: 'Evidencia Ausente',
          text: mensaje
        });
      } catch (error) {
        console.log('El usuario canceló la acción de compartir o hubo un error.', error);
      }
    } else {
      alert('Tu dispositivo actual no soporta enviar la foto automáticamente. Abriremos WhatsApp para que la adjuntes manualmente desde tu galería.');
      window.open(`https://wa.me/5493512224737?text=${encodeURIComponent(mensaje)}`, '_blank');
    }

    event.target.value = '';
  };

  const misTareas = useMemo(() => {
    if (!miMovil) return [];
    let filtradas = tasks.filter(task => task.movil === miMovil && task.estado !== 'FINALIZADA');

    filtradas.sort((a, b) => {
      if (sortOrder === 'geo') {
        const centerLat = -31.656228;
        const centerLng = -64.433808;
        const distA = Math.pow((a.lat || 0) - centerLat, 2) + Math.pow((a.lng || 0) - centerLng, 2);
        const distB = Math.pow((b.lat || 0) - centerLat, 2) + Math.pow((b.lng || 0) - centerLng, 2);
        return distA - distB;
      }

      if (sortOrder === 'asc') {
        return new Date(a.fechaReclamo).getTime() - new Date(b.fechaReclamo).getTime();
      }

      const pW = { '1-CRÍTICA': 1, '2-ALTA': 2, '3-MEDIA': 3, '4-BAJA': 4 };
      if (pW[a.prioridad] !== pW[b.prioridad]) return (pW[a.prioridad] || 5) - (pW[b.prioridad] || 5);
      return new Date(a.fechaReclamo).getTime() - new Date(b.fechaReclamo).getTime();
    });
    return filtradas;
  }, [tasks, miMovil, sortOrder]);

  const completedTasks = useMemo(() => {
    return tasks.filter(task => task.movil === miMovil && task.estado === 'FINALIZADA' && !task.reportado);
  }, [tasks, miMovil]);

  const getPriorityBadge = (prioridad) => {
    if (prioridad.includes('1-')) return 'bg-red-600 text-white animate-pulse shadow-red-200';
    if (prioridad.includes('2-')) return 'bg-orange-500 text-white shadow-orange-200';
    if (prioridad.includes('3-')) return 'bg-blue-500 text-white shadow-blue-200';
    return 'bg-slate-500 text-white shadow-slate-200';
  };

  const handleGeneratePDF = () => {
    if (!kmFinal) {
      alert("Debes ingresar el kilometraje final para cerrar el turno.");
      return;
    }

    setIsGeneratingPDF(true);
    const generateRealPDF = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text("Reporte de Turno", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Móvil Asignado: ${miMovil}`, 14, 32);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 14, 37);

      doc.setTextColor(79, 70, 229);
      doc.text(`Cuadrilla: ${formVehiculo.tecnico1} ${formVehiculo.tecnico2 && formVehiculo.tecnico2 !== 'NINGUNO' ? '& ' + formVehiculo.tecnico2 : ''}`, 14, 44);
      doc.text(`Km Inicial: ${formVehiculo.kmInicial}   |   Km Final: ${kmFinal}   |   Combustible: ${formVehiculo.combustible}`, 14, 49);
      doc.text(`Obs. Vehículo: ${formVehiculo.observaciones || 'Ninguna'}`, 14, 54);

      doc.setTextColor(100, 116, 139);
      doc.text(`Total Completadas: ${completedTasks.length} Tareas`, 14, 61);

      const tableColumn = ["N° Abonado", "Apellido y Nombre", "Direccion", "Resolucion"];
      const tableRows = completedTasks.map(t => [t.nroCliente, t.cliente, t.direccion, t.resolucionTecnico ? t.resolucionTecnico : 'Sin detalles']);

      doc.autoTable({
        startY: 67,
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

      onSaveForm('CIERRE DE TURNO', miMovil, {
        tecnico1: formVehiculo.tecnico1,
        tecnico2: formVehiculo.tecnico2,
        kmInicial: formVehiculo.kmInicial,
        kmFinal: kmFinal,
        combustible: formVehiculo.combustible,
        observaciones: formVehiculo.observaciones,
        tareasCompletadas: completedTasks.length
      });

      completedTasks.forEach(t => {
        onUpdateTask(t.id, 'reportado', true);
      });

      setIsGeneratingPDF(false);
      setShowKmFinalModal(false);

      setFormVehiculo({ tecnico1: '', tecnico2: '', kmInicial: '', combustible: 'Medio (1/2)', observaciones: '' });
      setIsFormCompleted(false);
      setKmFinal('');
      setTechView('menu');
      setMiMovil(null);

      try {
        localStorage.removeItem(`isFormCompleted_${miMovil}`);
        localStorage.removeItem(`formVehiculo_${miMovil}`);
        localStorage.removeItem('miMovil');
      } catch (e) { }
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

  const handleFullLogout = () => {
    try {
      localStorage.removeItem('miMovil');
    } catch (e) { }
    setMiMovil(null);
    onLogout();
  };

  if (!miMovil) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 animate-in fade-in w-full max-w-md mx-auto relative">
        <div className="w-full bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl text-center border border-white/20 relative">
          <button onClick={onLogout} className="absolute top-4 right-4 p-2 bg-white/10 text-white/70 hover:bg-red-500 hover:text-white rounded-full transition-colors border border-transparent">
            <X className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 mt-2 text-white">
            <Truck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Mi Turno</h1>
          <p className="text-white/80 mb-8 text-sm">Selecciona en qué móvil estás operando hoy.</p>
          <div className="grid grid-cols-1 gap-3">
            {movilesList.map(movil => (
              <button key={movil} onClick={() => setSelectedMovilAuth(movil)} className="w-full py-4 bg-slate-50 hover:bg-slate-200 border-2 border-black text-black font-bold text-lg rounded-2xl transition-all shadow-md flex justify-center items-center">
                <span>{movil}</span>
              </button>
            ))}
          </div>
        </div>
        {selectedMovilAuth && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
              <button onClick={() => { setSelectedMovilAuth(null); setMovilLoginError(false); setMovilPasswordInput(''); }} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center text-white mb-2">Acceso {selectedMovilAuth}</h2>
              <p className="text-center text-white/80 text-sm mb-6">Ingresa tu clave asignada para iniciar el turno.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const validPassword = movilPasswords[selectedMovilAuth] || '1234';
                if (movilPasswordInput === validPassword) {
                  const nextMovil = selectedMovilAuth;
                  setMiMovil(nextMovil);
                  try {
                    localStorage.setItem('miMovil', nextMovil);
                    const savedForm = localStorage.getItem(`formVehiculo_${nextMovil}`);
                    setFormVehiculo(savedForm ? JSON.parse(savedForm) : { tecnico1: '', tecnico2: '', kmInicial: '', combustible: 'Medio (1/2)', observaciones: '' });
                    setIsFormCompleted(localStorage.getItem(`isFormCompleted_${nextMovil}`) === 'true');
                  } catch (err) { }
                  setSelectedMovilAuth(null);
                  setMovilLoginError(false);
                  setMovilPasswordInput('');
                  setTechView('menu');
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

  // --- VISTA: MENÚ PRINCIPAL ---
  if (techView === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 flex flex-col p-4 w-full max-w-md mx-auto animate-in slide-in-from-left">
        <header className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border-2 border-black mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-xl text-black"><Truck className="w-5 h-5" /></div>
            <div>
              <h1 className="text-lg font-bold text-black leading-none">{miMovil}</h1>
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> En línea
              </span>
            </div>
          </div>
          <button onClick={handleFullLogout} className="p-2 text-black hover:text-slate-700 bg-slate-50 hover:bg-slate-200 rounded-full transition-colors"><LogOut className="w-5 h-5" /></button>
        </header>

        <h2 className="text-xl font-bold text-black mb-4 px-2">Menú Principal</h2>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setTechView('form')}
            className="p-6 bg-white rounded-3xl shadow-sm border-2 border-black flex items-center gap-4 hover:bg-slate-50 transition-colors relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-indigo-100 text-black rounded-full flex items-center justify-center shrink-0"><ClipboardCheck className="w-7 h-7" /></div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-black">Formulario Móvil</h3>
              <p className="text-sm text-black">{isFormCompleted ? 'Completado' : 'Requerido para iniciar'}</p>
            </div>
            {isFormCompleted ? <CheckCircle className="w-6 h-6 text-emerald-600 absolute right-6 top-1/2 -translate-y-1/2" /> : <ChevronRight className="w-6 h-6 text-black absolute right-6 top-1/2 -translate-y-1/2" />}
          </button>

          <button
            onClick={() => {
              if (!isFormCompleted) alert('Por favor, completa el Formulario Móvil antes de acceder a tus tareas.');
              else setTechView('tareas');
            }}
            className={`p-6 rounded-3xl shadow-sm border-2 border-black flex items-center gap-4 transition-colors relative ${isFormCompleted ? 'bg-white cursor-pointer hover:bg-slate-50' : 'bg-white opacity-70 cursor-not-allowed'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${isFormCompleted ? 'bg-emerald-100 text-black' : 'bg-slate-200 text-black'}`}>
              <List className="w-7 h-7" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-black">Tareas Asignadas</h3>
              <p className="text-sm text-black">{misTareas.length} pendientes</p>
            </div>
            {!isFormCompleted ? <Lock className="w-5 h-5 text-black absolute right-6 top-1/2 -translate-y-1/2" /> : <ChevronRight className="w-6 h-6 text-black absolute right-6 top-1/2 -translate-y-1/2" />}
          </button>

          <button
            onClick={() => setTechView('manuales')}
            className="p-6 bg-white rounded-3xl shadow-sm border-2 border-black flex items-center gap-4 hover:bg-slate-50 transition-colors relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-blue-100 text-black rounded-full flex items-center justify-center shrink-0"><Wifi className="w-7 h-7" /></div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-black">Accesos Router</h3>
              <p className="text-sm text-black">Credenciales por defecto</p>
            </div>
            <ChevronRight className="w-6 h-6 text-black absolute right-6 top-1/2 -translate-y-1/2" />
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA: FORMULARIO MÓVIL ---
  if (techView === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 flex flex-col p-4 w-full max-w-md mx-auto animate-in slide-in-from-right">
        <header className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-6">
          <button onClick={() => setTechView('menu')} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-none">Check-in Vehículo</h2>
            <p className="text-xs text-slate-500 mt-1">{miMovil}</p>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6 relative">
          {dropdownOpen && <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(null)}></div>}

          <div className="relative z-50">
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-indigo-500" /> Cuadrilla - Técnico 1</label>
            <div
              onClick={() => setDropdownOpen(dropdownOpen === 'tecnico1' ? null : 'tecnico1')}
              className="w-full p-3 border border-slate-300 rounded-xl bg-white flex justify-between items-center cursor-pointer shadow-sm"
            >
              <span className={formVehiculo.tecnico1 ? "font-bold text-slate-800" : "text-slate-500 font-medium"}>
                {formVehiculo.tecnico1 || "SELECCIONAR TÉCNICO..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen === 'tecnico1' ? 'rotate-180' : ''}`} />
            </div>
            {dropdownOpen === 'tecnico1' && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95">
                {tecnicosList.map(t => (
                  <div
                    key={t}
                    onClick={() => { setFormVehiculo({ ...formVehiculo, tecnico1: t }); setDropdownOpen(null); }}
                    className="p-3.5 border-b border-slate-100 last:border-0 font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative z-40">
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User className="w-4 h-4 text-indigo-500" /> Cuadrilla - Técnico 2</label>
            <div
              onClick={() => setDropdownOpen(dropdownOpen === 'tecnico2' ? null : 'tecnico2')}
              className="w-full p-3 border border-slate-300 rounded-xl bg-white flex justify-between items-center cursor-pointer shadow-sm"
            >
              <span className={formVehiculo.tecnico2 ? "font-bold text-slate-800" : "text-slate-500 font-medium"}>
                {formVehiculo.tecnico2 || "SELECCIONAR TÉCNICO..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen === 'tecnico2' ? 'rotate-180' : ''}`} />
            </div>
            {dropdownOpen === 'tecnico2' && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95">
                <div
                  onClick={() => { setFormVehiculo({ ...formVehiculo, tecnico2: 'NINGUNO' }); setDropdownOpen(null); }}
                  className="p-3.5 border-b border-slate-100 font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
                >
                  NINGUNO (TRABAJO SOLO)
                </div>
                {tecnicosList.map(t => (
                  <div
                    key={t}
                    onClick={() => { setFormVehiculo({ ...formVehiculo, tecnico2: t }); setDropdownOpen(null); }}
                    className="p-3.5 border-b border-slate-100 last:border-0 font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Gauge className="w-4 h-4 text-indigo-500" /> Kilometraje Inicial</label>
            <input
              type="number"
              value={formVehiculo.kmInicial}
              onChange={(e) => setFormVehiculo({ ...formVehiculo, kmInicial: e.target.value })}
              className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              placeholder="Ej. 125000"
            />
          </div>

          <div className="relative z-30">
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Fuel className="w-4 h-4 text-orange-500" /> Nivel de Combustible</label>
            <div
              onClick={() => setDropdownOpen(dropdownOpen === 'combustible' ? null : 'combustible')}
              className="w-full p-3 border border-slate-300 rounded-xl bg-white flex justify-between items-center cursor-pointer shadow-sm"
            >
              <span className="font-bold text-slate-800">
                {formVehiculo.combustible}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen === 'combustible' ? 'rotate-180' : ''}`} />
            </div>
            {dropdownOpen === 'combustible' && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95">
                {['Reserva', '1/4 Tanque', 'Medio (1/2)', '3/4 Tanque', 'Lleno'].map(c => (
                  <div
                    key={c}
                    onClick={() => { setFormVehiculo({ ...formVehiculo, combustible: c }); setDropdownOpen(null); }}
                    className="p-3.5 border-b border-slate-100 last:border-0 font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /> Observaciones del Vehículo</label>
            <textarea
              value={formVehiculo.observaciones}
              onChange={(e) => setFormVehiculo({ ...formVehiculo, observaciones: e.target.value })}
              className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-sm"
              rows="3"
              placeholder="Ej. óptica derecha rota, falta rueda de auxilio..."
            ></textarea>
          </div>
          <button
            onClick={() => {
              if (!formVehiculo.tecnico1) alert("Por favor selecciona al Técnico 1 de la cuadrilla.");
              else if (!formVehiculo.tecnico2) alert("Por favor selecciona al Técnico 2 de la cuadrilla (o 'Ninguno').");
              else if (!formVehiculo.kmInicial) alert("Por favor ingresa el kilometraje inicial.");
              else {
                setIsFormCompleted(true);
                try {
                  localStorage.setItem(`isFormCompleted_${miMovil}`, 'true');
                  localStorage.setItem(`formVehiculo_${miMovil}`, JSON.stringify(formVehiculo));
                } catch (e) { }

                // Generar PDF
                try {
                  const docPdf = new jsPDF();

                  docPdf.setFillColor(79, 70, 229); // indigo-600
                  docPdf.rect(0, 0, 210, 30, 'F');
                  docPdf.setTextColor(255, 255, 255);
                  docPdf.setFontSize(16);
                  docPdf.text('REPORTE DE CHECK-IN', 15, 20);

                  docPdf.setTextColor(40, 40, 40);
                  docPdf.setFontSize(12);

                  const today = new Date().toLocaleDateString('es-AR');
                  const time = new Date().toLocaleTimeString('es-AR');

                  docPdf.text(`Fecha y Hora: ${today} ${time}`, 15, 45);
                  docPdf.text(`Vehículo: ${miMovil}`, 15, 55);
                  docPdf.text(`Técnico 1: ${formVehiculo.tecnico1}`, 15, 65);
                  docPdf.text(`Técnico 2: ${formVehiculo.tecnico2}`, 15, 75);
                  docPdf.text(`Kilometraje Inicial: ${formVehiculo.kmInicial} km`, 15, 85);
                  docPdf.text(`Nivel de Combustible: ${formVehiculo.combustible}`, 15, 95);

                  docPdf.setFontSize(14);
                  docPdf.setTextColor(20, 20, 20);
                  docPdf.text('Observaciones del Vehículo:', 15, 115);

                  docPdf.setFontSize(11);
                  docPdf.setTextColor(60, 60, 60);
                  const splitObs = docPdf.splitTextToSize(formVehiculo.observaciones || 'Sin observaciones registradas.', 180);
                  docPdf.text(splitObs, 15, 125);

                  docPdf.save(`Check-in-${miMovil.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
                } catch (err) {
                  console.error('Error generando PDF:', err);
                }

                setTechView('menu');
                onSaveForm('CHECK-IN VEHÍCULO', miMovil, formVehiculo);
              }
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-md transition-colors mt-2"
          >
            Guardar Formulario
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA: MANUALES (AHORA ACCESOS MÓDEM/ROUTER) ---
  if (techView === 'manuales') {
    const modems = [
      { marca: 'ARRIS', ip: '192.168.0.1', user: 'admin', pass: 'password' },
      { marca: 'HITRON', ip: '192.168.0.1', user: 'cusadmin', pass: 'password' },
      { marca: 'MOTOROLA', ip: '192.168.0.1', user: 'admin', pass: 'motorola' },
      { marca: 'NETGEAR', ip: '192.168.0.1', user: 'MSO', pass: 'changeme' },
      { marca: 'TECHNICOLOR', ip: '192.168.0.1', user: 'admin', pass: 'W2402' },
      { marca: 'Router GLC', ip: '192.168.1.254', user: 'guest', pass: 'guest@....' }
    ];

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col p-4 w-full max-w-md mx-auto animate-in slide-in-from-right">
        <header className="flex items-center gap-4 bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-700 mb-6">
          <button onClick={() => setTechView('menu')} className="p-2 bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">Accesos Módem/Router</h2>
            <p className="text-xs text-slate-400 mt-1">Credenciales por defecto</p>
          </div>
        </header>

        <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="p-4 text-sm font-semibold text-slate-300">Marca / Router</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Dirección IP</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Usuario</th>
                  <th className="p-4 text-sm font-semibold text-slate-300">Contraseña</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {modems.map((modem, index) => (
                  <tr key={index} className="hover:bg-slate-700/50 transition-colors group">
                    <td className="p-4 text-sm font-bold text-white">{modem.marca}</td>
                    <td className="p-4 text-sm text-slate-300 font-mono tracking-wide">{modem.ip}</td>
                    <td className="p-4 text-sm text-slate-300">{modem.user}</td>
                    <td className="p-4 text-sm text-slate-300 font-mono">{modem.pass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-900/50 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
            <Wifi className="w-4 h-4" /> Uso exclusivo para técnicos en campo.
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA: TAREAS ASIGNADAS (El panel original de mapas y trabajos) ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 font-sans pb-32 w-full max-w-md mx-auto shadow-2xl relative animate-in slide-in-from-right print:hidden">

      {/* Modal Lector QR / Barcode */}
      {scanningField && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-indigo-600">
                <QrCode className="w-6 h-6" />
                <h3 className="text-lg font-bold text-slate-800">Escanear Equipo</h3>
              </div>
              <button onClick={() => setScanningField(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div id="qr-reader" className="w-full rounded-xl overflow-hidden border-2 border-slate-200 mb-2"></div>
            <p className="text-sm text-center text-slate-500 font-medium">Apunta la cámara al código de barras o QR del equipo {scanningField === 'instalado' ? 'nuevo a instalar' : 'que estás retirando'}.</p>
          </div>
        </div>
      )}

      {/* MODAL KILOMETRAJE FINAL (CIERRE DE TURNO) */}
      {showKmFinalModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600"><Gauge className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Cierre de Turno</h3>
            <p className="text-sm text-slate-500 mb-6">Ingresa el kilometraje final para generar el reporte.</p>
            <input
              type="number"
              value={kmFinal}
              onChange={(e) => setKmFinal(e.target.value)}
              className="w-full p-4 border border-slate-300 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 mb-4 text-center text-lg font-bold"
              placeholder="Km Final"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowKmFinalModal(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-bold transition-colors">Cancelar</button>
              <button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors shadow-md">
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-20 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => setTechView('menu')} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors mr-1"><ArrowLeft className="w-4 h-4" /></button>
          <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Truck className="w-5 h-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-none">{miMovil}</h1>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> En línea
            </span>
          </div>
        </div>
      </header>

      <main className="p-4 flex flex-col gap-4 mt-2">
        {misTareas.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-black p-4 mb-2">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MapIcon className="w-5 h-5 text-indigo-600" /> Mi Hoja de Ruta</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 shadow-sm">
                  <Type className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step="0.1"
                    value={textSizeMultiplier}
                    onChange={(e) => setTextSizeMultiplier(parseFloat(e.target.value))}
                    className="w-20 sm:w-24 accent-indigo-600"
                    title="Aumentar tamaño de texto"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 shadow-sm w-fit">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="bg-transparent border-0 text-xs font-semibold text-slate-600 focus:ring-0 outline-none cursor-pointer py-1 pr-6"
                  >
                    <option value="prioridad">Por Prioridad</option>
                    <option value="asc">Más antiguos</option>
                    <option value="geo">Ruta sugerida</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="w-full h-64 bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative z-0">
              <iframe title="Mapa Ruta Técnico" srcDoc={generateMapHTML(misTareas, sortOrder === 'geo', movilesList, true)} className="w-full h-full border-none"></iframe>
            </div>
          </div>
        )}

        {misTareas.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-black mt-10">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Todo al día!</h2>
            <p className="text-slate-500 text-sm">No tienes tareas asignadas.</p>
          </div>
        ) : (
          misTareas.map((task) => (
            <div key={task.id} className={`bg-white rounded-3xl shadow-sm border border-black overflow-hidden transition-all duration-300 ${task.estado === 'EN CURSO' ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}>
              <div className={`px-4 py-2.5 flex justify-between items-center shadow-sm ${getPriorityBadge(task.prioridad)}`}>
                <span className="font-bold text-sm tracking-wide">{task.tipo}</span>
                <span className="text-xs font-bold uppercase bg-black/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">{task.prioridad}</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3" style={{ fontSize: `${1.125 * textSizeMultiplier}rem`, lineHeight: 1.2 }}><User className="w-5 h-5 text-slate-400 shrink-0" /> {task.cliente}</h3>
                <div className="space-y-3 mb-5">
                  <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${task.estado === 'EN CURSO' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                    <MapPin className={`w-5 h-5 mt-0.5 shrink-0 ${task.estado === 'EN CURSO' ? 'text-blue-500' : 'text-indigo-500'}`} />
                    <p className="font-medium text-slate-700 leading-tight" style={{ fontSize: `${0.875 * textSizeMultiplier}rem` }}>{task.direccion}</p>
                  </div>
                  <div className="flex justify-between items-center px-1 flex-wrap gap-2 mt-2">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Cliente: {task.nroCliente}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Ingreso: {task.fechaReclamo}</p>
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
                      {task.telefono ? (
                        <div className="flex flex-col gap-3">
                          <p className="text-sm font-bold text-slate-800 text-center">{task.telefono}</p>
                          <div className="flex gap-2">
                            <a href={`tel:${task.telefono.replace(/[^0-9+]/g, '')}`} target="_top" className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm"><PhoneCall className="w-4 h-4" /> Llamar</a>
                            <a href={`https://wa.me/549${task.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola somos Tajamar Internet y Cable, le escribimos para avisarle...')}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
                          </div>
                        </div>
                      ) : <p className="text-sm text-slate-500 italic text-center py-2">Sin número registrado.</p>}
                    </div>
                  )}
                </div>

                {(task.servicios || task.observacion) && (
                  <div className="mb-2">
                    <button onClick={() => toggleServicios(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedServicios[task.id] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 hover:bg-emerald-50/50 text-slate-600 border-slate-200'}`}>
                      <div className="flex items-center gap-2"><Package className="w-4 h-4" /><span className="text-sm font-semibold">Servicios y Observaciones</span></div>
                      {expandedServicios[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expandedServicios[task.id] && (
                      <div className="p-4 mt-2 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-inner text-sm font-medium text-emerald-900 flex flex-col gap-3">
                        {task.servicios && (
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-emerald-600 mb-1">Servicios</span>
                            {task.servicios}
                          </div>
                        )}
                        {task.observacion && (
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-emerald-600 mb-1">Observaciones</span>
                            {task.observacion}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <button onClick={() => toggleAusente(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedAusente[task.id] ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 hover:bg-orange-50/50 text-slate-600 border-slate-200'}`}>
                    <div className="flex items-center gap-2"><UserX className="w-4 h-4" /><span className="text-sm font-semibold">Reportar Ausente</span></div>
                    {expandedAusente[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedAusente[task.id] && (
                    <div className="p-4 mt-2 bg-orange-50/50 border border-orange-100 rounded-xl shadow-inner animate-in slide-in-from-top-2">
                      <p className="text-sm text-center text-slate-700 font-medium mb-3">Si no encuentras al cliente, repórtalo aquí:</p>
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/5493512224737?text=${encodeURIComponent(`*AUSENTE*\nCliente: ${task.cliente}\nNro Abonado: ${task.nroCliente}\nDirección: ${task.direccion}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-green-500 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>

                        <label
                          htmlFor={`camera-${task.id}`}
                          className={`flex-1 ${compressingTaskId === task.id ? 'bg-slate-600 cursor-wait' : 'bg-slate-800 cursor-pointer'} text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm shadow-sm`}
                        >
                          {compressingTaskId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          {compressingTaskId === task.id ? 'Comprimiendo...' : 'Cámara'}
                          <input type="file" accept="image/*" capture="environment" id={`camera-${task.id}`} className="hidden" disabled={compressingTaskId === task.id} onChange={(e) => handleCameraCapture(e, task)} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {task.tipo === 'DESCONEXION' && (
                  <div className="mb-2">
                    <button onClick={() => toggleProblema(task.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border ${expandedProblema[task.id] ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 hover:bg-red-50/50 text-slate-600 border-slate-200'}`}>
                      <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span className="text-sm font-semibold">Informar Problema</span></div>
                      {expandedProblema[task.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expandedProblema[task.id] && (
                      <div className="p-4 mt-2 bg-red-50/50 border border-red-100 rounded-xl shadow-inner animate-in slide-in-from-top-2">
                        <p className="text-sm text-center text-slate-700 font-medium mb-3">Selecciona el problema para informar por WhatsApp:</p>
                        <div className="flex flex-col gap-2">
                          <a
                            href={`https://wa.me/5493512224737?text=${encodeURIComponent(`*PROBLEMA: NO SE ENCONTRÓ DIRECCIÓN*\nCliente: ${task.cliente}\nNro Abonado: ${task.nroCliente}\nDirección: ${task.direccion}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm shadow-sm"
                          >
                            <MapPin className="w-4 h-4" /> No se encontró dirección
                          </a>
                          <a
                            href={`https://wa.me/5493512224737?text=${encodeURIComponent(`*PROBLEMA: PROMESA DE PAGO*\nCliente: ${task.cliente}\nNro Abonado: ${task.nroCliente}\nDirección: ${task.direccion}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm shadow-sm"
                          >
                            <Clock className="w-4 h-4" /> Promesa de pago
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={`grid gap-3 mt-4 border-t border-slate-100 pt-4 ${taskToConfirm === task.id ? 'grid-cols-1' : (task.estado === 'EN CURSO' ? 'grid-cols-3' : 'grid-cols-2')}`}>
                  {taskToConfirm === task.id ? (
                    <div className="col-span-full flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in shadow-inner">
                      <div>
                        <label className="text-sm font-semibold text-slate-700 mb-1 block">Resolución de Tarea:</label>
                        <select
                          value={quickSelectVal}
                          className="w-full p-3 mb-2 rounded-xl border border-slate-300 text-sm outline-none bg-white text-slate-600 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          onChange={(e) => {
                            const selectedText = e.target.value;
                            setQuickSelectVal(selectedText);
                            if (selectedText) {
                              setResolucionTexto(prev => prev ? prev + (prev.endsWith(' ') ? '' : ' ') + selectedText : selectedText);
                              setTimeout(() => setQuickSelectVal(""), 400);
                            }
                          }}
                        >
                          <option value="">+ Agregar texto rápido...</option>
                          {resolucionOpciones.map(opcion => (
                            <option key={opcion} value={opcion}>{opcion}</option>
                          ))}
                        </select>
                        <textarea className="w-full p-3 rounded-xl border border-slate-300 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500 shadow-sm" rows="3" placeholder="Detalle del trabajo..." value={resolucionTexto} onChange={(e) => setResolucionTexto(e.target.value)}></textarea>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">MAC/Serie Instalado</label>
                          <div className="flex bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                            <input type="text" value={macInstalado} onChange={e => setMacInstalado(e.target.value)} className="w-full p-2.5 text-xs outline-none font-mono" placeholder="Ingresar..." />
                            <button onClick={() => setScanningField('instalado')} className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border-l border-slate-200"><QrCode className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">MAC/Serie Retirado</label>
                          <div className="flex bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                            <input type="text" value={macRetirado} onChange={e => setMacRetirado(e.target.value)} className="w-full p-2.5 text-xs outline-none font-mono" placeholder="Ingresar..." />
                            <button onClick={() => setScanningField('retirado')} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border-l border-slate-200"><QrCode className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                        <button onClick={() => { setTaskToConfirm(null); setResolucionTexto(''); setMacInstalado(''); setMacRetirado(''); setQuickSelectVal(''); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl py-3 font-bold text-sm transition-colors">Cancelar</button>
                        <button onClick={() => {
                          let finalRes = resolucionTexto;
                          if (macInstalado) finalRes += `\n[Instalado: ${macInstalado}]`;
                          if (macRetirado) finalRes += `\n[Retirado: ${macRetirado}]`;
                          onUpdateTask(task.id, { estado: 'FINALIZADA', resolucionTecnico: finalRes.trim(), horaFin: Date.now() });
                          setTaskToConfirm(null);
                          setResolucionTexto('');
                          setMacInstalado('');
                          setMacRetirado('');
                          setQuickSelectVal('');
                        }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 font-bold text-sm shadow-md transition-colors">Confirmar</button>
                      </div>
                    </div>
                  ) : (
                    <React.Fragment>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`} target="_blank" rel="noopener noreferrer" className={`flex flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-700 font-semibold py-3.5 rounded-2xl border border-slate-200 ${task.estado === 'EN CURSO' ? 'text-xs' : 'text-sm'}`}><Navigation className="w-5 h-5" /> <span>Navegar</span></a>
                      {task.estado !== 'EN CURSO' ? (
                        <button onClick={() => onUpdateTask(task.id, { estado: 'EN CURSO', horaInicio: Date.now() })} className="flex flex-col items-center justify-center gap-1.5 bg-blue-50 text-blue-700 font-semibold py-3.5 rounded-2xl border border-blue-200 text-sm"><Play className="w-5 h-5" fill="currentColor" /> Comenzar</button>
                      ) : (
                        <React.Fragment>
                          <button onClick={() => onUpdateTask(task.id, { estado: 'PENDIENTE', horaInicio: null })} className="flex flex-col items-center justify-center gap-1.5 bg-red-50 text-red-600 font-semibold py-3.5 rounded-2xl border border-red-200 text-xs hover:bg-red-100 transition-colors"><X className="w-5 h-5" /> Cancelar</button>
                          <button onClick={() => { setTaskToConfirm(task.id); setResolucionTexto(''); setQuickSelectVal(''); }} className="flex flex-col items-center justify-center gap-1.5 bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl shadow-md text-xs hover:bg-emerald-600 transition-colors"><CheckCircle className="w-5 h-5" /> Finalizar</button>
                        </React.Fragment>
                      )}
                    </React.Fragment>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {completedTasks.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowCompletedList(!showCompletedList)}
              className="w-full bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex justify-between items-center transition-colors shadow-sm"
              style={{ borderBottomLeftRadius: showCompletedList ? '0' : '1rem', borderBottomRightRadius: showCompletedList ? '0' : '1rem' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-indigo-900">Tareas Finalizadas ({completedTasks.length})</span>
              </div>
              {showCompletedList ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-indigo-600" />}
            </button>

            {showCompletedList && (
              <div className="bg-white border-x border-b border-indigo-100 rounded-b-2xl shadow-inner divide-y divide-slate-100 animate-in slide-in-from-top-2">
                {completedTasks.map(task => (
                  <div key={task.id} className="p-4 flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {task.cliente}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {task.tipo}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400" /> N° Abonado: {task.nroCliente}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 mb-4">
          <div className="bg-slate-800 rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
            <h3 className="text-white font-bold text-lg mb-1 relative z-10">Cierre de Turno</h3>
            <p className="text-slate-300 text-sm mb-5 relative z-10">Reporte con {completedTasks.length} tareas.</p>
            <button onClick={() => {
              if (completedTasks.length === 0) alert("Aún no tienes tareas finalizadas para generar reporte.");
              else setShowKmFinalModal(true);
            }} className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md relative z-10 bg-indigo-500 hover:bg-indigo-600 text-white">
              <FileText className="w-5 h-5" /> Cerrar y Reportar PDF
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

  const [appRole, setAppRole] = useState(() => {
    try { return localStorage.getItem('appRole') || null; } catch (e) { return null; }
  });

  const handleSetRole = (role) => {
    setAppRole(role);
    try {
      if (role) {
        localStorage.setItem('appRole', role);
      } else {
        localStorage.removeItem('appRole');
      }
    } catch (e) { }
  };

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showSettingsAuth, setShowSettingsAuth] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [settingsLoginError, setSettingsLoginError] = useState(false);

  // Estados para Archivo de Formularios
  const [formulariosGuardados, setFormulariosGuardados] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedFormDetail, setSelectedFormDetail] = useState(null);
  const [expandedArchiveDates, setExpandedArchiveDates] = useState({});

  const toggleArchiveDate = (dateKey) => {
    setExpandedArchiveDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Estados de Configuración
  const [validAdminPassword, setValidAdminPassword] = useState('admin123');
  const [validSettingsPassword, setValidSettingsPassword] = useState('config123');
  const [isTimeTrackingEnabled, setIsTimeTrackingEnabled] = useState(true);
  const [newAdminPwd, setNewAdminPwd] = useState('');
  const [confirmAdminPwd, setConfirmAdminPwd] = useState('');
  const [pwdUpdateMsg, setPwdUpdateMsg] = useState({ text: '', type: '' });

  const [newSettingsPwd, setNewSettingsPwd] = useState('');
  const [confirmSettingsPwd, setConfirmSettingsPwd] = useState('');
  const [settingsPwdUpdateMsg, setSettingsPwdUpdateMsg] = useState({ text: '', type: '' });

  // Estados de Títulos Personalizados
  const [appTitle, setAppTitle] = useState('Sistema Gestor de Tareas');
  const [adminTitle, setAdminTitle] = useState('Centro de Coordinación');
  const [newAppTitle, setNewAppTitle] = useState('');
  const [newAdminTitle, setNewAdminTitle] = useState('');
  const [titleUpdateMsg, setTitleUpdateMsg] = useState({ text: '', type: '' });

  // Estado para el logo personalizado
  const [customLogo, setCustomLogo] = useState(null);
  const [logoUploadError, setLogoUploadError] = useState('');

  const [movilesList, setMovilesList] = useState(['MÓVIL 1', 'MÓVIL 2', 'MÓVIL 3', 'MÓVIL 4']);
  const [movilPasswords, setMovilPasswords] = useState({
    'MÓVIL 1': 'movil1', 'MÓVIL 2': 'movil2', 'MÓVIL 3': 'movil3', 'MÓVIL 4': 'movil4'
  });

  const [selectedMovilEdit, setSelectedMovilEdit] = useState('');
  const [newMovilPwd, setNewMovilPwd] = useState('');
  const [confirmMovilPwd, setConfirmMovilPwd] = useState('');
  const [movilPwdUpdateMsg, setMovilPwdUpdateMsg] = useState({ text: '', type: '' });

  // Estados para la gestión de móviles
  const [editingMovil, setEditingMovil] = useState(null);
  const [newMovilName, setNewMovilName] = useState('');
  const [deleteConfirmMovil, setDeleteConfirmMovil] = useState(null);
  const [movilManageError, setMovilManageError] = useState('');

  // Estados para Opciones de Resolución Rápidas
  const defaultResoluciones = [
    'Reparacion de cable interno', 'Reparacion de cable de bordeo', 'Se programo tv',
    'Se configuro modem o deco', 'Corte de energia', 'Se calibro linea',
    'Se reparo fuente', 'Se mejoro db', 'Se chequeo servicio', 'Se reparo linea'
  ];
  const [resolucionOpciones, setResolucionOpciones] = useState(defaultResoluciones);
  const [newResolucion, setNewResolucion] = useState('');
  const [resolucionManageError, setResolucionManageError] = useState('');
  const [editingResolucion, setEditingResolucion] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
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

    const configDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
    const unsubConfig = onSnapshot(configDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.moviles) setMovilesList(data.moviles);
        if (data.passwords) setMovilPasswords(data.passwords);
        if (data.adminPwd) setValidAdminPassword(data.adminPwd);
        if (data.settingsPwd) setValidSettingsPassword(data.settingsPwd);
        if (data.resoluciones) setResolucionOpciones(data.resoluciones);
        if (data.appTitle) setAppTitle(data.appTitle);
        if (data.adminTitle) setAdminTitle(data.adminTitle);
        if (data.customLogo !== undefined) setCustomLogo(data.customLogo);
      }
    });

    setSyncStatus('Sincronizando...');
    const tasksCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tareas');
    const unsubscribe = onSnapshot(tasksCollection,
      (snapshot) => {
        if (snapshot.empty) setTasks([]);
        else setTasks(snapshot.docs.map(doc => doc.data()));
        setLoading(false);
        setSyncStatus('En línea');
      },
      (error) => {
        setSyncStatus('Desconectado');
        setLoading(false);
      }
    );

    // Cargar Archivo de Formularios
    const formsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'formularios');
    const unsubForms = onSnapshot(formsCollection, (snapshot) => {
      setFormulariosGuardados(snapshot.docs.map(doc => doc.data()));
    });

    return () => {
      unsubscribe();
      unsubConfig();
      unsubForms();
    };
  }, [user]);

  // Función para guardar formularios
  const handleSaveFormulario = async (tipo, autor, datos) => {
    if (!user) return;
    const newForm = {
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      tipo,
      autor,
      datos,
      timestamp: Date.now(),
      fecha: new Date().toLocaleDateString('es-AR')
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'formularios', newForm.id), newForm);
    } catch (e) {
      console.error("Error guardando form:", e);
    }
  };

  const saveConfigToFirebase = async (updates) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings'), updates, { merge: true });
    } catch (err) {
      console.error("Error guardando configuración:", err);
    }
  };

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

  // AGRUPAR FORMULARIOS POR FECHA
  const sortedForms = [...formulariosGuardados].sort((a, b) => b.timestamp - a.timestamp);
  const groupedForms = sortedForms.reduce((acc, form) => {
    if (!acc[form.fecha]) acc[form.fecha] = [];
    acc[form.fecha].push(form);
    return acc;
  }, {});

  if (!appRole) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex flex-col items-end gap-3 z-10">
        <button onClick={() => setShowSettingsAuth(true)} className="p-3 rounded-full hover:bg-slate-800 transition-colors group bg-slate-800/30" title="Configuración">
          <Settings className="w-7 h-7 text-slate-400 group-hover:text-slate-300 group-hover:rotate-90 transition-all duration-300" />
        </button>
        <button
          onClick={() => {
            if (window.confirm('¿Estás seguro de limpiar la memoria local? Esto recargará la aplicación y solucionará problemas de caché.')) {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }
          }}
          className="p-2 bg-slate-800/30 hover:bg-red-600/90 text-slate-500 hover:text-white rounded-full transition-all flex items-center justify-center shadow-sm"
          title="Limpiar Memoria Local (Caché)"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="text-center mb-10 w-full max-w-2xl mt-12 sm:mt-0">
        <div className="w-40 h-40 mx-auto mb-6 rounded-full overflow-hidden shadow-2xl ring-4 ring-fuchsia-500/30 flex items-center justify-center bg-white p-1">
          <img
            src={customLogo || "./logo-tajamar.jpeg"}
            alt="Tajamar TV"
            className="w-full h-full object-contain rounded-full"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://ui-avatars.com/api/?name=Tajamar&background=d946ef&color=fff&size=128";
            }}
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{appTitle}</h1>
        <p className="text-slate-400">Selecciona tu perfil de ingreso</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <button onClick={() => setShowAdminLogin(true)} className="flex-1 bg-gradient-to-br from-[#7441de] to-[#ca28cc] p-8 rounded-3xl hover:brightness-110 border-4 border-white transition-all text-center group shadow-xl">
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform text-white"><Lock className="w-10 h-10" /></div>
          <h2 className="text-xl font-bold text-white mb-2">Coordinador</h2>
          <p className="text-sm text-white/80">Gestión total y mapa general.</p>
        </button>
        <button onClick={() => handleSetRole('TECNICO')} className="flex-1 bg-gradient-to-br from-[#7441de] to-[#ca28cc] p-8 rounded-3xl hover:brightness-110 border-4 border-white transition-all text-center group shadow-xl">
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform text-white"><Smartphone className="w-10 h-10" /></div>
          <h2 className="text-xl font-bold text-white mb-2">Técnico Móvil</h2>
          <p className="text-sm text-white/80">Hojas de ruta y tareas diarias.</p>
        </button>
      </div>

      <div className="mt-6 w-full max-w-md">
        <button onClick={() => setShowArchive(true)} className="w-full bg-slate-800 hover:bg-slate-700 p-5 rounded-3xl border border-slate-700 transition-all text-center flex items-center justify-center gap-3 group text-white shadow-lg">
          <Archive className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
          <span className="font-bold">Historial de Formularios Guardados</span>
        </button>
      </div>

      {/* VISTA DEL ARCHIVO DE FORMULARIOS */}
      {showArchive && (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-5">
          <header className="bg-slate-900 text-white p-4 flex items-center gap-4 shadow-md shrink-0">
            <button onClick={() => setShowArchive(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
            <div>
              <h2 className="text-xl font-bold">Archivo de Formularios</h2>
              <p className="text-xs text-slate-400">Registros guardados en la nube</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50">
            <div className="max-w-3xl mx-auto space-y-6">
              {Object.keys(groupedForms).length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-bold">El archivo está vacío.</p>
                  <p className="text-sm">Los formularios aparecerán aquí cuando sean guardados.</p>
                </div>
              ) : (
                Object.keys(groupedForms).map(dateKey => (
                  <div key={dateKey} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div
                      className="bg-slate-100 px-5 py-3 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => toggleArchiveDate(dateKey)}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        {dateKey} <span className="text-xs font-normal text-slate-500 ml-2">({groupedForms[dateKey].length} registros)</span>
                      </div>
                      {expandedArchiveDates[dateKey] ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </div>
                    {expandedArchiveDates[dateKey] && (
                      <div className="divide-y divide-slate-100">
                        {groupedForms[dateKey].map(form => (
                          <div key={form.id} onClick={() => setSelectedFormDetail(form)} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center group">
                            <div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${form.tipo === 'CHECK-IN VEHÍCULO' ? 'bg-indigo-100 text-indigo-700' : form.tipo === 'CIERRE DE TURNO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                                {form.tipo}
                              </span>
                              <h3 className="font-bold text-slate-800 mt-2 flex items-center gap-2">
                                {form.tipo === 'REPORTE GENERAL' ? <Monitor className="w-4 h-4 text-slate-400" /> : <Truck className="w-4 h-4 text-slate-400" />}
                                {form.autor}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(form.timestamp).toLocaleTimeString('es-AR')}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE FORMULARIO */}
      {selectedFormDetail && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setSelectedFormDetail(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            <div className="mb-4 pr-8">
              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{selectedFormDetail.tipo}</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">{selectedFormDetail.autor}</h2>
              <p className="text-xs text-slate-500">{selectedFormDetail.fecha} - {new Date(selectedFormDetail.timestamp).toLocaleTimeString('es-AR')}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
              {selectedFormDetail.tipo === 'REPORTE GENERAL' ? (
                <div><strong>Total Tareas Activas:</strong> {selectedFormDetail.datos.totalTareas}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="block text-[10px] uppercase font-bold text-slate-400">Técnico 1</span>{selectedFormDetail.datos.tecnico1 || '-'}</div>
                    <div><span className="block text-[10px] uppercase font-bold text-slate-400">Técnico 2</span>{selectedFormDetail.datos.tecnico2 || '-'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div><span className="block text-[10px] uppercase font-bold text-slate-400">Km Inicial</span>{selectedFormDetail.datos.kmInicial || '-'}</div>
                    {selectedFormDetail.tipo === 'CIERRE DE TURNO' && (
                      <div><span className="block text-[10px] uppercase font-bold text-slate-400">Km Final</span>{selectedFormDetail.datos.kmFinal || '-'}</div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Combustible</span>
                    {selectedFormDetail.datos.combustible || '-'}
                  </div>
                  {selectedFormDetail.tipo === 'CIERRE DE TURNO' && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Tareas Completadas</span>
                      <span className="font-bold text-indigo-600 text-base">{selectedFormDetail.datos.tareasCompletadas || 0}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Observaciones Vehículo</span>
                    <p className="italic">{selectedFormDetail.datos.observaciones || 'Ninguna'}</p>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setSelectedFormDetail(null)} className="w-full mt-4 bg-slate-800 text-white font-bold py-3.5 rounded-2xl hover:bg-slate-900 transition-colors shadow-md">Cerrar Detalle</button>
          </div>
        </div>
      )}

      {showSettingsAuth && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 backdrop-blur-xl border-2 border-black rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => { setShowSettingsAuth(false); setSettingsLoginError(false); setSettingsPassword(''); }} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full transition-colors border-2 border-black"><X className="w-5 h-5" /></button>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><Settings className="w-8 h-8" /></div>
            <h2 className="text-2xl font-bold text-center text-white mb-2">Acceso Configuración</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (settingsPassword === validSettingsPassword) {
                setShowSettingsModal(true);
                setShowSettingsAuth(false);
                setSettingsLoginError(false);
                setSettingsPassword('');
              } else setSettingsLoginError(true);
            }}>
              <div className="mb-4">
                <input type="password" placeholder="Contraseña" value={settingsPassword} onChange={(e) => { setSettingsPassword(e.target.value); setSettingsLoginError(false); }} className={`w-full p-4 border rounded-2xl outline-none focus:ring-2 transition-all text-center tracking-widest ${settingsLoginError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-slate-200'}`} autoFocus />
                {settingsLoginError && <p className="text-red-500 text-xs font-bold mt-2 ml-1 text-center animate-pulse">Clave incorrecta.</p>}
              </div>
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-md border-2 border-black">Ingresar</button>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col border-2 border-black">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Configuración</h2>
              </div>
              <button onClick={() => { setShowSettingsModal(false); setEditingMovil(null); setDeleteConfirmMovil(null); setMovilManageError(''); setResolucionManageError(''); setEditingResolucion(null); setTitleUpdateMsg({ text: '', type: '' }); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors border-2 border-black">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2 pb-2 custom-scrollbar flex-1">
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-700">Estado de Red</p>
                  <p className="text-xs text-slate-500">{syncStatus}</p>
                </div>
                {syncStatus === 'En línea' ? <Cloud className="w-5 h-5 text-emerald-500" /> : <CloudOff className="w-5 h-5 text-slate-400" />}
              </div>


              {/* GESTIÓN DE MÓVILES (Nuevo Panel) */}
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Truck className="w-4 h-4" /> Gestión de Flota (Móviles)</p>

                <div className="flex flex-col gap-2">
                  {movilesList.map(m => (
                    <div key={m} className="flex gap-2 items-center bg-white p-2 rounded-lg border-2 border-black shadow-sm">
                      {editingMovil?.old === m ? (
                        <input
                          type="text"
                          value={editingMovil.new}
                          onChange={(e) => setEditingMovil({ ...editingMovil, new: e.target.value.toUpperCase() })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newName = editingMovil.new.trim();
                              if (!newName || newName === m) { setEditingMovil(null); return; }
                              if (movilesList.includes(newName)) { setMovilManageError('El nombre ya existe.'); return; }

                              const updatedMoviles = movilesList.map(mov => mov === m ? newName : mov);
                              const updatedPasswords = { ...movilPasswords };
                              updatedPasswords[newName] = updatedPasswords[m] || '1234';
                              delete updatedPasswords[m];

                              setMovilesList(updatedMoviles);
                              setMovilPasswords(updatedPasswords);
                              setEditingMovil(null);
                              setMovilManageError('');
                              saveConfigToFirebase({ moviles: updatedMoviles, passwords: updatedPasswords });

                              tasks.forEach(t => {
                                if (t.movil === m) handleUpdateTask(t.id, 'movil', newName);
                              });
                            }
                          }}
                          className="flex-1 p-1.5 text-sm border rounded font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-sm font-bold text-slate-700 pl-1">{m}</span>
                      )}

                      {editingMovil?.old === m ? (
                        <>
                          <button onClick={async () => {
                            const newName = editingMovil.new.trim();
                            if (!newName || newName === m) { setEditingMovil(null); return; }
                            if (movilesList.includes(newName)) { setMovilManageError('El nombre ya existe.'); return; }

                            const updatedMoviles = movilesList.map(mov => mov === m ? newName : mov);
                            const updatedPasswords = { ...movilPasswords };
                            updatedPasswords[newName] = updatedPasswords[m] || '1234';
                            delete updatedPasswords[m];

                            setMovilesList(updatedMoviles);
                            setMovilPasswords(updatedPasswords);
                            setEditingMovil(null);
                            setMovilManageError('');
                            saveConfigToFirebase({ moviles: updatedMoviles, passwords: updatedPasswords });

                            // Reasignar tareas con el viejo nombre
                            tasks.forEach(t => {
                              if (t.movil === m) handleUpdateTask(t.id, 'movil', newName);
                            });
                          }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors border-2 border-black"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingMovil(null); setMovilManageError(''); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors border-2 border-black"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingMovil({ old: m, new: m }); setMovilManageError(''); setDeleteConfirmMovil(null); }} className="text-xs text-indigo-600 font-bold px-2 py-1.5 hover:bg-indigo-50 rounded transition-colors border-2 border-black">Renombrar</button>
                          <button onClick={() => { setDeleteConfirmMovil(m); setEditingMovil(null); setMovilManageError(''); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors border-2 border-black"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {deleteConfirmMovil && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-center animate-in zoom-in-95">
                    ¿Eliminar <strong>{deleteConfirmMovil}</strong>?<br />
                    <span className="text-xs text-red-600 font-medium">Las tareas asignadas pasarán a "SIN ASIGNAR".</span>
                    <div className="flex justify-center gap-2 mt-2">
                      <button onClick={() => setDeleteConfirmMovil(null)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-md font-bold text-xs hover:bg-slate-300 transition-colors border-2 border-black">Cancelar</button>
                      <button onClick={() => {
                        const updatedMoviles = movilesList.filter(mov => mov !== deleteConfirmMovil);
                        const updatedPasswords = { ...movilPasswords };
                        delete updatedPasswords[deleteConfirmMovil];

                        setMovilesList(updatedMoviles);
                        setMovilPasswords(updatedPasswords);
                        setDeleteConfirmMovil(null);
                        saveConfigToFirebase({ moviles: updatedMoviles, passwords: updatedPasswords });

                        tasks.forEach(t => {
                          if (t.movil === deleteConfirmMovil) handleUpdateTask(t.id, 'movil', 'SIN ASIGNAR');
                        });
                      }} className="px-3 py-1.5 bg-red-600 text-white rounded-md font-bold text-xs hover:bg-red-700 transition-colors shadow-sm border-2 border-black">Sí, Eliminar</button>
                    </div>
                  </div>
                )}

                {movilManageError && <p className="text-xs text-red-500 font-bold text-center mt-1">{movilManageError}</p>}

                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newMovilName}
                    onChange={(e) => { setNewMovilName(e.target.value.toUpperCase()); setMovilManageError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = newMovilName.trim();
                        if (!name) return;
                        if (movilesList.includes(name) || name === 'SIN ASIGNAR') { setMovilManageError('El nombre ya existe o no es válido.'); return; }
                        const updatedMoviles = [...movilesList, name];
                        const updatedPasswords = { ...movilPasswords, [name]: '1234' };
                        setMovilesList(updatedMoviles);
                        setMovilPasswords(updatedPasswords);
                        setNewMovilName('');
                        saveConfigToFirebase({ moviles: updatedMoviles, passwords: updatedPasswords });
                      }
                    }}
                    placeholder="Nuevo Móvil..."
                    className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const name = newMovilName.trim();
                      if (!name) return;
                      if (movilesList.includes(name) || name === 'SIN ASIGNAR') { setMovilManageError('El nombre ya existe o no es válido.'); return; }
                      const updatedMoviles = [...movilesList, name];
                      const updatedPasswords = { ...movilPasswords, [name]: '1234' };
                      setMovilesList(updatedMoviles);
                      setMovilPasswords(updatedPasswords);
                      setNewMovilName('');
                      saveConfigToFirebase({ moviles: updatedMoviles, passwords: updatedPasswords });
                    }}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm border-2 border-black"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Lock className="w-4 h-4" /> Clave Coordinador</p>
                <input type="password" placeholder="Nueva clave" value={newAdminPwd} onChange={(e) => { setNewAdminPwd(e.target.value); setPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="password" placeholder="Confirmar" value={confirmAdminPwd} onChange={(e) => { setConfirmAdminPwd(e.target.value); setPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={() => {
                  if (newAdminPwd.trim() === '') setPwdUpdateMsg({ text: 'No puede estar vacía.', type: 'error' });
                  else if (newAdminPwd !== confirmAdminPwd) setPwdUpdateMsg({ text: 'No coinciden.', type: 'error' });
                  else {
                    setValidAdminPassword(newAdminPwd);
                    setPwdUpdateMsg({ text: '¡Clave actualizada!', type: 'success' });
                    setNewAdminPwd('');
                    setConfirmAdminPwd('');
                    saveConfigToFirebase({ adminPwd: newAdminPwd });
                  }
                }} className="w-full bg-slate-200 text-slate-800 font-bold py-2 rounded-lg text-sm hover:bg-slate-300 transition-colors border-2 border-black">Actualizar</button>
                {pwdUpdateMsg.text && <p className={`text-xs text-center font-bold ${pwdUpdateMsg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{pwdUpdateMsg.text}</p>}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Lock className="w-4 h-4" /> Clave Configuración</p>
                <input type="password" placeholder="Nueva clave" value={newSettingsPwd} onChange={(e) => { setNewSettingsPwd(e.target.value); setSettingsPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="password" placeholder="Confirmar" value={confirmSettingsPwd} onChange={(e) => { setConfirmSettingsPwd(e.target.value); setSettingsPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={() => {
                  if (newSettingsPwd.trim() === '') setSettingsPwdUpdateMsg({ text: 'No puede estar vacía.', type: 'error' });
                  else if (newSettingsPwd !== confirmSettingsPwd) setSettingsPwdUpdateMsg({ text: 'No coinciden.', type: 'error' });
                  else {
                    setValidSettingsPassword(newSettingsPwd);
                    setSettingsPwdUpdateMsg({ text: '¡Clave actualizada!', type: 'success' });
                    setNewSettingsPwd('');
                    setConfirmSettingsPwd('');
                    saveConfigToFirebase({ settingsPwd: newSettingsPwd });
                  }
                }} className="w-full bg-slate-200 text-slate-800 font-bold py-2 rounded-lg text-sm hover:bg-slate-300 transition-colors border-2 border-black">Actualizar</button>
                {settingsPwdUpdateMsg.text && <p className={`text-xs text-center font-bold ${settingsPwdUpdateMsg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{settingsPwdUpdateMsg.text}</p>}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Smartphone className="w-4 h-4" /> Clave de Móviles</p>
                <select value={selectedMovilEdit || (movilesList[0] || '')} onChange={(e) => setSelectedMovilEdit(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none font-bold text-slate-700">
                  {movilesList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="password" placeholder="Nueva clave" value={newMovilPwd} onChange={(e) => { setNewMovilPwd(e.target.value); setMovilPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="password" placeholder="Confirmar" value={confirmMovilPwd} onChange={(e) => { setConfirmMovilPwd(e.target.value); setMovilPwdUpdateMsg({ text: '', type: '' }); }} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={() => {
                  const targetMovil = selectedMovilEdit || movilesList[0];
                  if (newMovilPwd.trim() === '') setMovilPwdUpdateMsg({ text: 'No puede estar vacía.', type: 'error' });
                  else if (newMovilPwd !== confirmMovilPwd) setMovilPwdUpdateMsg({ text: 'No coinciden.', type: 'error' });
                  else {
                    const updatedPasswords = { ...movilPasswords, [targetMovil]: newMovilPwd };
                    setMovilPasswords(updatedPasswords);
                    setMovilPwdUpdateMsg({ text: `¡Clave actualizada!`, type: 'success' });
                    setNewMovilPwd('');
                    setConfirmMovilPwd('');
                    saveConfigToFirebase({ passwords: updatedPasswords });
                  }
                }} className="w-full bg-slate-200 text-slate-800 font-bold py-2 rounded-lg text-sm hover:bg-slate-300 transition-colors border-2 border-black">Actualizar</button>
                {movilPwdUpdateMsg.text && <p className={`text-xs text-center font-bold ${movilPwdUpdateMsg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{movilPwdUpdateMsg.text}</p>}
              </div>

              {/* GESTIÓN DE RESOLUCIONES RÁPIDAS (Nuevo Panel) */}
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><List className="w-4 h-4" /> Opciones de Resolución</p>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {resolucionOpciones.map(res => (
                    <div key={res} className="flex justify-between items-center bg-white p-2 rounded-lg border-2 border-black shadow-sm gap-2">
                      {editingResolucion?.old === res ? (
                        <input
                          type="text"
                          value={editingResolucion.new}
                          onChange={(e) => setEditingResolucion({ ...editingResolucion, new: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newName = editingResolucion.new.trim();
                              if (!newName || newName === res) { setEditingResolucion(null); return; }
                              if (resolucionOpciones.includes(newName)) { setResolucionManageError('La opción ya existe.'); return; }

                              const updatedRes = resolucionOpciones.map(r => r === res ? newName : r);
                              setResolucionOpciones(updatedRes);
                              setEditingResolucion(null);
                              setResolucionManageError('');
                              saveConfigToFirebase({ resoluciones: updatedRes });
                            }
                          }}
                          className="flex-1 p-1.5 text-xs border rounded font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-xs font-bold text-slate-700 truncate">{res}</span>
                      )}

                      {editingResolucion?.old === res ? (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => {
                            const newName = editingResolucion.new.trim();
                            if (!newName || newName === res) { setEditingResolucion(null); return; }
                            if (resolucionOpciones.includes(newName)) { setResolucionManageError('La opción ya existe.'); return; }

                            const updatedRes = resolucionOpciones.map(r => r === res ? newName : r);
                            setResolucionOpciones(updatedRes);
                            setEditingResolucion(null);
                            setResolucionManageError('');
                            saveConfigToFirebase({ resoluciones: updatedRes });
                          }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors border-2 border-black"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingResolucion(null); setResolucionManageError(''); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors border-2 border-black"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditingResolucion({ old: res, new: res }); setResolucionManageError(''); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors border-2 border-black"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => {
                            const updatedRes = resolucionOpciones.filter(r => r !== res);
                            setResolucionOpciones(updatedRes);
                            saveConfigToFirebase({ resoluciones: updatedRes });
                          }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors border-2 border-black"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {resolucionManageError && <p className="text-xs text-red-500 font-bold text-center mt-1">{resolucionManageError}</p>}
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newResolucion}
                    onChange={(e) => { setNewResolucion(e.target.value); setResolucionManageError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = newResolucion.trim();
                        if (!name) return;
                        if (resolucionOpciones.includes(name)) { setResolucionManageError('La opción ya existe.'); return; }
                        const updatedRes = [...resolucionOpciones, name];
                        setResolucionOpciones(updatedRes);
                        setNewResolucion('');
                        saveConfigToFirebase({ resoluciones: updatedRes });
                      }
                    }}
                    placeholder="Nueva opción..."
                    className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const name = newResolucion.trim();
                      if (!name) return;
                      if (resolucionOpciones.includes(name)) { setResolucionManageError('La opción ya existe.'); return; }
                      const updatedRes = [...resolucionOpciones, name];
                      setResolucionOpciones(updatedRes);
                      setNewResolucion('');
                      saveConfigToFirebase({ resoluciones: updatedRes });
                    }}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors shadow-sm border-2 border-black"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* PERSONALIZACIÓN DE TÍTULOS E INICIO (Nuevo Panel) */}
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-black flex flex-col gap-3">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Type className="w-4 h-4" /> Personalización de Títulos e Inicio</p>

                <div className="mb-2 pb-3 border-b border-slate-200">
                  <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Logo de Aplicación (Max 200KB)</label>
                  {logoUploadError && <p className="text-xs text-red-500 font-bold mb-2">{logoUploadError}</p>}
                  <div className="flex items-center gap-3">
                    {customLogo && <img src={customLogo} alt="Logo" className="w-10 h-10 rounded-full object-contain bg-white border border-slate-200 shrink-0" />}
                    <div className="flex-1 flex flex-col gap-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 200 * 1024) {
                            setLogoUploadError('La imagen supera los 200KB. Intenta con una más pequeña.');
                            return;
                          }
                          setLogoUploadError('');
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target.result;
                            setCustomLogo(base64);
                            saveConfigToFirebase({ customLogo: base64 });
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="text-xs w-full file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                      />
                      {customLogo && (
                        <button
                          onClick={() => { setCustomLogo(null); saveConfigToFirebase({ customLogo: null }); setLogoUploadError(''); }}
                          className="text-[10px] text-red-500 font-bold hover:underline self-start mt-1 p-1 rounded border-2 border-black"
                        >
                          Restablecer logo por defecto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Título Menú Principal</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder={appTitle} value={newAppTitle} onChange={(e) => { setNewAppTitle(e.target.value); setTitleUpdateMsg({ text: '', type: '' }); }} className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => {
                      if (!newAppTitle.trim()) return;
                      setAppTitle(newAppTitle);
                      saveConfigToFirebase({ appTitle: newAppTitle });
                      setTitleUpdateMsg({ text: 'Título principal actualizado', type: 'success' });
                      setNewAppTitle('');
                    }} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors shadow-sm border-2 border-black">Guardar</button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Título Panel Coordinador</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder={adminTitle} value={newAdminTitle} onChange={(e) => { setNewAdminTitle(e.target.value); setTitleUpdateMsg({ text: '', type: '' }); }} className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => {
                      if (!newAdminTitle.trim()) return;
                      setAdminTitle(newAdminTitle);
                      saveConfigToFirebase({ adminTitle: newAdminTitle });
                      setTitleUpdateMsg({ text: 'Título de coordinador actualizado', type: 'success' });
                      setNewAdminTitle('');
                    }} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors shadow-sm border-2 border-black">Guardar</button>
                  </div>
                </div>
                {titleUpdateMsg.text && <p className={`text-xs text-center font-bold ${titleUpdateMsg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{titleUpdateMsg.text}</p>}
              </div>

            </div>
            <button onClick={() => { setShowSettingsModal(false); setEditingMovil(null); setDeleteConfirmMovil(null); setMovilManageError(''); setResolucionManageError(''); setEditingResolucion(null); setTitleUpdateMsg({ text: '', type: '' }); }} className="w-full mt-4 bg-slate-800 text-white font-bold py-3.5 rounded-2xl shrink-0 hover:bg-slate-900 transition-colors shadow-md border-2 border-black">Cerrar</button>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#7441de]/80 to-[#ca28cc]/80 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => { setShowAdminLogin(false); setLoginError(false); setAdminPassword(''); }} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full transition-colors"><X className="w-5 h-5" /></button>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-white"><Monitor className="w-8 h-8" /></div>
            <h2 className="text-2xl font-bold text-center text-white mb-2">Acceso Coordinador</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (adminPassword === validAdminPassword) { handleSetRole('ADMIN'); setShowAdminLogin(false); setLoginError(false); setAdminPassword(''); }
              else setLoginError(true);
            }}>
              <div className="mb-4">
                <input type="password" placeholder="Contraseña" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setLoginError(false); }} className={`w-full p-4 border rounded-2xl outline-none focus:ring-2 text-center tracking-widest ${loginError ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200'}`} autoFocus />
                {loginError && <p className="text-red-500 text-xs font-bold mt-2 ml-1 text-center animate-pulse">Clave incorrecta.</p>}
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-md">Ingresar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (appRole === 'ADMIN') return <AdminDashboard tasks={tasks} onUpdateTask={handleUpdateTask} syncStatus={syncStatus} onLogout={() => handleSetRole(null)} isTimeTrackingEnabled={isTimeTrackingEnabled} movilesList={movilesList} adminTitle={adminTitle} onSaveForm={handleSaveFormulario} />;
  if (appRole === 'TECNICO') return <TecnicoDashboard tasks={tasks} onUpdateTask={handleUpdateTask} onLogout={() => handleSetRole(null)} movilPasswords={movilPasswords} movilesList={movilesList} resolucionOpciones={resolucionOpciones} onSaveForm={handleSaveFormulario} />;
  return null;
}