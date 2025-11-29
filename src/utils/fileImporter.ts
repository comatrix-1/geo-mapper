import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import type { MapObject, Layer } from '../types';
import type { LatLngLiteral } from 'leaflet';

interface ImportResult {
  layer: Layer;
  objects: MapObject[];
}

interface ProjectData {
  version: string;
  timestamp: number;
  layers: Layer[];
  objects: MapObject[];
}

// Convert GeoJSON coordinates [lng, lat] to Leaflet {lat, lng}
const toLatLng = (coords: number[]): LatLngLiteral => {
  if (!coords || coords.length < 2) return { lat: 0, lng: 0 };
  return { lat: coords[1], lng: coords[0] };
};

// Helper to safely extract string properties
const safeString = (val: any, fallback: string = ''): string => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
     if (val.value) return String(val.value);
     return fallback;
  }
  return String(val);
};

// Smart title extraction from properties
const getTitleFromProps = (props: any): string => {
    if (!props) return 'Untitled Object';
    const keys = Object.keys(props);
    
    // 1. Exact matches for common name fields
    const nameKey = keys.find(k => /^(name|title|label|objectid)$/i.test(k));
    if (nameKey) return safeString(props[nameKey]);
    
    // 2. Matches for keys ending in _N (common in GIS data, e.g., PLN_AREA_N)
    const nameLikeKey = keys.find(k => /_N$/i.test(k));
    if (nameLikeKey) return safeString(props[nameLikeKey]);

    return 'Untitled Object';
};

// Recursive function to extract simple geometries from complex ones
const extractObjectsFromGeometry = (geometry: any, props: any, layerId: string, objects: MapObject[]) => {
    if (!geometry) return;

    const title = getTitleFromProps(props);
    const description = safeString(props.description || props.DESCRIPTION || props.desc, '');
    
    switch (geometry.type) {
        case 'Point':
            objects.push({
                id: crypto.randomUUID(),
                layerId,
                type: 'point',
                title,
                description,
                position: toLatLng(geometry.coordinates)
            });
            break;
            
        case 'LineString':
            objects.push({
                id: crypto.randomUUID(),
                layerId,
                type: 'polyline',
                title,
                description,
                positions: (geometry.coordinates || []).map((c: number[]) => toLatLng(c))
            });
            break;
            
        case 'Polygon':
             // Handle simple polygon (outer ring only for this app's data model)
             if (geometry.coordinates && geometry.coordinates.length > 0) {
                objects.push({
                    id: crypto.randomUUID(),
                    layerId,
                    type: 'polygon',
                    title,
                    description,
                    positions: geometry.coordinates[0].map((c: number[]) => toLatLng(c))
                });
             }
            break;
            
        case 'GeometryCollection':
            if (geometry.geometries && Array.isArray(geometry.geometries)) {
                geometry.geometries.forEach((g: any) => {
                    extractObjectsFromGeometry(g, props, layerId, objects);
                });
            }
            break;

        case 'MultiPoint':
             if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                 geometry.coordinates.forEach((coords: number[]) => {
                     extractObjectsFromGeometry({ type: 'Point', coordinates: coords }, props, layerId, objects);
                 });
             }
             break;

        case 'MultiLineString':
             if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                 geometry.coordinates.forEach((coords: number[][]) => {
                     extractObjectsFromGeometry({ type: 'LineString', coordinates: coords }, props, layerId, objects);
                 });
             }
             break;
             
         case 'MultiPolygon':
             if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
                 geometry.coordinates.forEach((coords: number[][][]) => {
                     extractObjectsFromGeometry({ type: 'Polygon', coordinates: coords }, props, layerId, objects);
                 });
             }
             break;
    }
};

const processGeoJSON = (fc: any, layerId: string): MapObject[] => {
  const objects: MapObject[] = [];

  if (!fc) return objects;

  // 1. Handle FeatureCollection (Standard)
  if (fc.type === 'FeatureCollection' && Array.isArray(fc.features)) {
      fc.features.forEach((feature: any) => {
          extractObjectsFromGeometry(feature.geometry, feature.properties || {}, layerId, objects);
      });
  } 
  // 2. Handle Single Feature
  else if (fc.type === 'Feature') {
      extractObjectsFromGeometry(fc.geometry, fc.properties || {}, layerId, objects);
  }
  // 3. Handle raw Geometry (Fallback)
  else if (fc.type === 'Point' || fc.type === 'LineString' || fc.type === 'Polygon' || fc.type === 'GeometryCollection') {
      extractObjectsFromGeometry(fc, {}, layerId, objects);
  }

  return objects;
};

export const importFile = async (file: File): Promise<ImportResult> => {
  let contentString = '';
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  // Create a new layer definition
  const layerId = crypto.randomUUID();
  
  // Default style for imports: Black border, transparent fill (preferred for maps)
  const layer: Layer = {
    id: layerId,
    name: fileName.replace(/\.[^/.]+$/, ""), // remove extension
    visible: true,
    style: {
        borderColor: '#000000',
        borderWidth: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.0 // colorless/transparent by default
    }
  };

  try {
    let geoJSON: any = null;

    if (extension === 'kmz') {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      const kmlFilename = Object.keys(unzipped.files).find(f => f.toLowerCase().endsWith('.kml'));
      
      if (!kmlFilename) {
        throw new Error('No KML file found inside KMZ archive.');
      }
      contentString = await unzipped.files[kmlFilename].async('string');
      
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(contentString, 'text/xml');
      if (kmlDom.getElementsByTagName("parsererror").length > 0) {
          throw new Error("Error parsing internal KML XML.");
      }
      geoJSON = toGeoJSON.kml(kmlDom);

    } else if (extension === 'kml') {
      contentString = await file.text();
      // Remove BOM
      if (contentString.charCodeAt(0) === 0xFEFF) {
        contentString = contentString.slice(1);
      }
      contentString = contentString.trim();

      // Try parsing as XML first
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(contentString, 'text/xml');
      const parserErrors = kmlDom.getElementsByTagName("parsererror");
      
      if (parserErrors.length === 0) {
          geoJSON = toGeoJSON.kml(kmlDom);
      } else {
          // Fallback: Check if it's actually JSON misnamed as KML
          try {
              geoJSON = JSON.parse(contentString);
              console.warn("File extension was .kml but content was JSON. Parsed as GeoJSON.");
          } catch (e) {
              throw new Error("Invalid KML file: " + parserErrors[0].textContent);
          }
      }

    } else if (extension === 'json' || extension === 'geojson') {
        contentString = await file.text();
        geoJSON = JSON.parse(contentString);
    } else {
      throw new Error('Unsupported file format. Please upload .kml, .kmz, .json, or .geojson');
    }

    // Process the GeoJSON (whether from KML conversion or direct JSON)
    const objects = processGeoJSON(geoJSON, layerId);

    return { layer, objects };

  } catch (error) {
    console.error("Import failed", error);
    throw error;
  }
};

// Re-export as legacy name for compatibility if needed, but prefer importFile
export const importKmlKmz = importFile;

export const saveProjectToFile = (layers: Layer[], objects: MapObject[]) => {
    const data: ProjectData = {
        version: '1.0',
        timestamp: Date.now(),
        layers,
        objects
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `map-project-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const loadProjectFromFile = async (file: File): Promise<{ layers: Layer[], objects: MapObject[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (!json.layers || !json.objects) {
                    throw new Error("Invalid project file format");
                }
                resolve({ layers: json.layers, objects: json.objects });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};
