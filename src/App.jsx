import { useEffect, useState, lazy, Suspense } from 'react';
import 'leaflet/dist/leaflet.css';
import './index.css';
import * as topojson from 'topojson-client';

const MapContainer = lazy(() => import('react-leaflet').then(m => ({ default: m.MapContainer })));
const TileLayer = lazy(() => import('react-leaflet').then(m => ({ default: m.TileLayer })));
const GeoJSON = lazy(() => import('react-leaflet').then(m => ({ default: m.GeoJSON })));
const CircleMarker = lazy(() => import('react-leaflet').then(m => ({ default: m.CircleMarker })));
const Tooltip = lazy(() => import('react-leaflet').then(m => ({ default: m.Tooltip })));
const Popup = lazy(() => import('react-leaflet').then(m => ({ default: m.Popup })));

const capitals = [
  { name: 'Washington, DC', coords: [38.9072, -77.0369] },
  { name: 'Ottawa', coords: [45.4215, -75.6972] },
  { name: 'Mexico City', coords: [19.4326, -99.1332] },
];

export default function App() {
  const [countries, setCountries] = useState(null);
  const [usStates, setUsStates] = useState(null);
  const [caProvinces, setCaProvinces] = useState(null);
  const [mxStates, setMxStates] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [layers, setLayers] = useState({
    countries: true,
    us: true,
    ca: true,
    mx: true,
  });

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const fetchTopo = async (file, objectName, setter, label, filter) => {
      try {
        const res = await fetch(`${base}data/${file}`);
        if (!res.ok) throw new Error(res.statusText);
        const topo = await res.json();
        const geo = topojson.feature(topo, topo.objects[objectName]);
        if (filter) geo.features = filter(geo.features);
        setter(geo);
      } catch (err) {
        setWarnings(w => [...w, `Failed to load ${label}`]);
      }
    };

    fetchTopo(
      'countries-110m.json',
      'countries',
      setCountries,
      'countries',
      features =>
        features.filter(f =>
          ['United States of America', 'Canada', 'Mexico'].includes(f.properties.name)
        )
    );
    fetchTopo('us-states-10m.json', 'states', setUsStates, 'US states');
    fetchTopo('canada-provinces-10m.json', 'provinces', setCaProvinces, 'Canadian provinces');
    fetchTopo('mexico-states-10m.json', 'states', setMxStates, 'Mexican states');
  }, []);

  useEffect(() => {
    if (countries) console.log('3 countries present', countries.features.length === 3);
    if (usStates) console.log('>= 50 US states', usStates.features.length >= 50);
    if (caProvinces) console.log('13 CA provinces and territories', caProvinces.features.length === 13);
    if (mxStates) console.log('32 MX states', mxStates.features.length === 32);
    const inRange = ([lat, lon]) => lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    console.log(
      'Capitals coords within valid ranges',
      capitals.every(c => inRange(c.coords))
    );
  }, [countries, usStates, caProvinces, mxStates]);

  const onEachFeature = (feature, layer) => {
    const name = feature.properties?.name || feature.id;
    if (name) layer.bindPopup(name);
  };

  const toggle = key => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="h-full">
      <div className="absolute top-0 left-0 z-[1000] bg-white p-2 text-sm">
        <div>
          <label><input type="checkbox" checked={layers.countries} onChange={() => toggle('countries')} /> Countries</label><br />
          <label><input type="checkbox" checked={layers.us} onChange={() => toggle('us')} /> US States</label><br />
          <label><input type="checkbox" checked={layers.ca} onChange={() => toggle('ca')} /> CA Provinces</label><br />
          <label><input type="checkbox" checked={layers.mx} onChange={() => toggle('mx')} /> MX States</label>
        </div>
        {warnings.map((w, i) => (
          <div key={i} className="text-red-600">{w}</div>
        ))}
      </div>
      <Suspense fallback={<div>Loading map...</div>}>
        <MapContainer center={[45, -95]} zoom={3} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {layers.countries && countries && (
            <GeoJSON data={countries} onEachFeature={onEachFeature} style={{ color: '#555', weight: 1 }} />
          )}
          {layers.us && usStates && (
            <GeoJSON data={usStates} onEachFeature={onEachFeature} style={{ color: 'blue', weight: 1 }} />
          )}
          {layers.ca && caProvinces && (
            <GeoJSON data={caProvinces} onEachFeature={onEachFeature} style={{ color: 'red', weight: 1 }} />
          )}
          {layers.mx && mxStates && (
            <GeoJSON data={mxStates} onEachFeature={onEachFeature} style={{ color: 'green', weight: 1 }} />
          )}
          {capitals.map(c => (
            <CircleMarker key={c.name} center={c.coords} radius={5} color="black">
              <Tooltip>{c.name}</Tooltip>
              <Popup>{c.name}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </Suspense>
    </div>
  );
}
