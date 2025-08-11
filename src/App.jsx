import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { feature as topo2geo } from "topojson-client";

const MapContainer = lazy(() => import("react-leaflet").then((m) => ({ default: m.MapContainer })));
const TileLayer = lazy(() => import("react-leaflet").then((m) => ({ default: m.TileLayer })));
const GeoJSON = lazy(() => import("react-leaflet").then((m) => ({ default: m.GeoJSON })));
const CircleMarker = lazy(() => import("react-leaflet").then((m) => ({ default: m.CircleMarker })));
const Tooltip = lazy(() => import("react-leaflet").then((m) => ({ default: m.Tooltip })));

const Panel = ({ children }) => (
  <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur rounded-2xl shadow-lg p-3 w-80 space-y-3 border border-gray-200">{children}</div>
);

const ToggleRow = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between text-sm font-medium text-gray-700 select-none">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="peer appearance-none w-11 h-6 rounded-full bg-gray-200 outline-none cursor-pointer relative transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow peer-checked:bg-indigo-600 peer-checked:after:translate-x-5 after:transition-all"
      aria-label={label}
    />
  </label>
);

const NATIONAL_CAPITALS = [
  { country: "United States", name: "Washington, DC", lat: 38.9072, lon: -77.0369 },
  { country: "Canada", name: "Ottawa", lat: 45.4215, lon: -75.6972 },
  { country: "Mexico", name: "Mexico City", lat: 19.4326, lon: -99.1332 }
];

const COUNTRY_NAME_BY_ID = { 840: "United States", 124: "Canada", 484: "Mexico" };

const FIPS_STATE_NAME = {
  1: "Alabama", 2: "Alaska", 4: "Arizona", 5: "Arkansas", 6: "California", 8: "Colorado", 9: "Connecticut", 10: "Delaware", 11: "District of Columbia", 12: "Florida", 13: "Georgia", 15: "Hawaii", 16: "Idaho", 17: "Illinois", 18: "Indiana", 19: "Iowa", 20: "Kansas", 21: "Kentucky", 22: "Louisiana", 23: "Maine", 24: "Maryland", 25: "Massachusetts", 26: "Michigan", 27: "Minnesota", 28: "Mississippi", 29: "Missouri", 30: "Montana", 31: "Nebraska", 32: "Nevada", 33: "New Hampshire", 34: "New Jersey", 35: "New Mexico", 36: "New York", 37: "North Carolina", 38: "North Dakota", 39: "Ohio", 40: "Oklahoma", 41: "Oregon", 42: "Pennsylvania", 44: "Rhode Island", 45: "South Carolina", 46: "South Dakota", 47: "Tennessee", 48: "Texas", 49: "Utah", 50: "Vermont", 51: "Virginia", 53: "Washington", 54: "West Virginia", 55: "Wisconsin", 56: "Wyoming", 60: "American Samoa", 66: "Guam", 69: "Northern Mariana Islands", 72: "Puerto Rico", 78: "U.S. Virgin Islands"
};

function ensureLeafletCSS() {
  if (typeof document === "undefined") return;
  var id = "leaflet-css-runtime";
  if (!document.getElementById(id)) {
    var link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
}

async function fetchTopoAsGeoJSON(url, objectName) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const topo = await res.json();
    const hasObjects = topo && topo.objects;
    const pick = hasObjects && objectName && topo.objects[objectName] ? objectName : hasObjects ? Object.keys(topo.objects)[0] : null;
    if (!pick) return null;
    const fc = topo2geo(topo, topo.objects[pick]);
    if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features) || fc.features.length === 0) return null;
    return fc;
  } catch {
    return null;
  }
}

function isFC(x) {
  return !!(x && typeof x === "object" && x.type === "FeatureCollection" && Array.isArray(x.features));
}

const countryStyle = { fillColor: "#c7d2fe", weight: 1, color: "#4f46e5", fillOpacity: 0.45 };
const stateStyle = { fillColor: "#e5e7eb", weight: 0.75, color: "#6b7280", fillOpacity: 0.35 };
const caProvStyle = { fillColor: "#bbf7d0", weight: 0.75, color: "#16a34a", fillOpacity: 0.3 };
const mxStateStyle = { fillColor: "#fecaca", weight: 0.75, color: "#dc2626", fillOpacity: 0.3 };

const EMPTY_FC = { type: "FeatureCollection", features: [] };

function buildCountrySubset(worldCountries, ids) {
  const src = worldCountries || EMPTY_FC;
  const features = (src.features || [])
    .filter((f) => ids.includes(Number(f.id)))
    .map((f) => ({ type: "Feature", geometry: f.geometry, properties: { ...(f.properties || {}), name: COUNTRY_NAME_BY_ID[Number(f.id)] || String(f.id) }, id: f.id }));
  return { type: "FeatureCollection", features };
}

function mapUSStateNames(statesFC) {
  const src = statesFC || EMPTY_FC;
  const features = (src.features || []).map((f) => ({ type: "Feature", geometry: f.geometry, properties: { ...(f.properties || {}), name: FIPS_STATE_NAME[Number(f.id)] || `State ${String(f.id != null ? f.id : "")}` }, id: f.id }));
  return { type: "FeatureCollection", features };
}

function runSmokeTests(countriesFC, usStatesFC, caFC, mxFC) {
  const results = [];
  results.push({ name: "countriesIsFeatureCollection", pass: !!(countriesFC && countriesFC.type === "FeatureCollection") });
  results.push({ name: "usStatesIsFeatureCollection", pass: !!(usStatesFC && usStatesFC.type === "FeatureCollection") });
  results.push({ name: "countriesCountIsThree", pass: countriesFC.features.length === 3, detail: String(countriesFC.features.length) });
  const countryIds = new Set((countriesFC.features || []).map((f) => Number(f.id)));
  results.push({ name: "countriesIDsCorrect", pass: [124, 484, 840].every((id) => countryIds.has(id)), detail: Array.from(countryIds).join(",") });
  const countryNames = new Set((countriesFC.features || []).map((f) => f.properties && f.properties.name));
  results.push({ name: "countriesHaveExpectedNames", pass: ["United States", "Canada", "Mexico"].every((n) => countryNames.has(n)), detail: Array.from(countryNames).join(",") });
  results.push({ name: "usStatesCountAtLeast50", pass: usStatesFC.features.length >= 50, detail: String(usStatesFC.features.length) });
  const nh = (usStatesFC.features || []).find((f) => Number(f.id) === 33);
  results.push({ name: "usStateNHName", pass: nh ? nh.properties && nh.properties.name === "New Hampshire" : true, detail: nh ? String(nh.properties && nh.properties.name) : "not-found" });
  const capsOk = NATIONAL_CAPITALS.every((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.lat <= 90 && c.lat >= -90 && c.lon <= 180 && c.lon >= -180);
  results.push({ name: "capitalsHaveValidLatLon", pass: capsOk });
  results.push({ name: "hasThreeCapitals", pass: NATIONAL_CAPITALS.length === 3, detail: String(NATIONAL_CAPITALS.length) });
  if (caFC) {
    results.push({ name: "canadaProvincesIsFeatureCollection", pass: !!(caFC && caFC.type === "FeatureCollection") });
    results.push({ name: "canadaProvincesCountIs13", pass: caFC.features.length === 13, detail: String(caFC.features.length) });
  }
  if (mxFC) {
    results.push({ name: "mexicoStatesIsFeatureCollection", pass: !!(mxFC && mxFC.type === "FeatureCollection") });
    results.push({ name: "mexicoStatesCountIs32", pass: mxFC.features.length === 32, detail: String(mxFC.features.length) });
  }
  return results;
}

export default function NorthAmericaInteractiveMap() {
  const [showCountries, setShowCountries] = useState(true);
  const [showUSStates, setShowUSStates] = useState(true);
  const [showCapitals, setShowCapitals] = useState(true);
  const [showCAProvinces, setShowCAProvinces] = useState(true);
  const [showMXStates, setShowMXStates] = useState(true);
  const [opacity, setOpacity] = useState(0.8);
  const [worldCountries, setWorldCountries] = useState(null);
  const [usStatesRaw, setUSStatesRaw] = useState(null);
  const [caProvinces, setCAProvinces] = useState(null);
  const [mxStates, setMXStates] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureLeafletCSS();
    setReady(true);
  }, []);

  useEffect(() => {
    var mounted = true;
    fetchTopoAsGeoJSON("https://unpkg.com/world-atlas@2/countries-110m.json", "countries").then((fc) => { if (mounted) setWorldCountries(fc); });
    fetchTopoAsGeoJSON("https://unpkg.com/us-atlas@3/states-10m.json", "states").then((fc) => { if (mounted) setUSStatesRaw(fc); });
    fetchTopoAsGeoJSON("https://unpkg.com/canada-atlas@1/provinces-10m.json", "provinces").then((fc) => { if (mounted) setCAProvinces(fc); });
    fetchTopoAsGeoJSON("https://unpkg.com/mexico-atlas@1/states-10m.json", "states").then((fc) => { if (mounted) setMXStates(fc); });
    return () => { mounted = false; };
  }, []);

  const countriesFC = useMemo(() => buildCountrySubset(worldCountries, [124, 484, 840]), [worldCountries]);
  const statesFC = useMemo(() => mapUSStateNames(usStatesRaw), [usStatesRaw]);

  useEffect(() => {
    const results = runSmokeTests(countriesFC, statesFC, caProvinces, mxStates);
    try { console.table(results); } catch (e) {}
  }, [countriesFC, statesFC, caProvinces, mxStates]);

  if (!ready) {
    return <div className="w-full h-[80vh] grid place-items-center text-sm text-gray-600">Loading…</div>;
  }

  return (
    <div className="w-full h-[80vh] relative">
      <Panel>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">North America Map Layers</h2>
          <ToggleRow label="Highlight countries (US, Canada, Mexico)" checked={showCountries} onChange={setShowCountries} />
          <ToggleRow label="Show U.S. state borders" checked={showUSStates} onChange={setShowUSStates} />
          <ToggleRow label="Show Canadian provinces & territories" checked={showCAProvinces} onChange={setShowCAProvinces} />
          <ToggleRow label="Show Mexican states" checked={showMXStates} onChange={setShowMXStates} />
          <ToggleRow label="Show national capitals" checked={showCapitals} onChange={setShowCapitals} />
          <div className="pt-2">
            <label className="block text-xs text-gray-600 mb-1">Layer opacity</label>
            <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" />
          </div>
          <p className="text-xs text-gray-500 leading-snug">Tip: zoom with your mouse or trackpad, and drag to pan. Hover to see names.</p>
        </div>
      </Panel>

      <Suspense fallback={<div className="w-full h-[80vh] grid place-items-center text-sm text-gray-600">Loading map…</div>}>
        <MapContainer center={[40, -97]} zoom={3} minZoom={2} maxZoom={8} className="w-full h-full rounded-2xl border border-gray-200 shadow" attributionControl>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

          {showCountries && isFC(countriesFC) && countriesFC.features.length > 0 && (
            <GeoJSON
              data={countriesFC}
              style={{ ...countryStyle, fillOpacity: opacity }}
              onEachFeature={(feature, layer) => {
                const props = feature && feature.properties ? feature.properties : {};
                const name = props.name || String(feature.id || "Country");
                layer.bindTooltip(String(name), { sticky: true });
              }}
            />
          )}

          {showCAProvinces && isFC(caProvinces) && caProvinces.features.length > 0 && (
            <GeoJSON
              data={caProvinces}
              style={{ ...caProvStyle, fillOpacity: Math.max(0.15, opacity - 0.25) }}
              onEachFeature={(feature, layer) => {
                const props = feature && feature.properties ? feature.properties : {};
                const name = props.name || props.abbrev || `Province`;
                layer.bindTooltip(String(name), { sticky: true });
              }}
            />
          )}

          {showMXStates && isFC(mxStates) && mxStates.features.length > 0 && (
            <GeoJSON
              data={mxStates}
              style={{ ...mxStateStyle, fillOpacity: Math.max(0.15, opacity - 0.25) }}
              onEachFeature={(feature, layer) => {
                const props = feature && feature.properties ? feature.properties : {};
                const name = props.name || props.nombre || `Estado`;
                layer.bindTooltip(String(name), { sticky: true });
              }}
            />
          )}

          {showUSStates && isFC(statesFC) && statesFC.features.length > 0 && (
            <GeoJSON
              data={statesFC}
              style={{ ...stateStyle, fillOpacity: Math.max(0.15, opacity - 0.25) }}
              onEachFeature={(feature, layer) => {
                const props = feature && feature.properties ? feature.properties : {};
                const name = props.name || `State ${String(feature.id != null ? feature.id : "")}`;
                layer.bindPopup(`<strong>${name}</strong>`);
                layer.on({ click: () => layer.openPopup() });
                layer.bindTooltip(String(name), { sticky: true });
              }}
            />
          )}

          {showCapitals && NATIONAL_CAPITALS.map((c) => (
            <CircleMarker key={c.name} center={[c.lat, c.lon]} radius={6} opacity={0.9} fillOpacity={0.95}>
              <Tooltip direction="top" offset={[0, -6]} permanent={false}>
                <div className="text-xs">
                  <div className="font-semibold">{c.name}</div>
                  <div className="opacity-80">{c.country}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </Suspense>

      <div className="absolute bottom-3 right-3 text-[11px] text-gray-600 bg-white/80 rounded-full px-3 py-1 shadow border border-gray-200">North America interactive map</div>
    </div>
  );
}
