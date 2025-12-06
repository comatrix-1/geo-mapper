import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngLiteral, LeafletMouseEvent } from "leaflet";
import type {
  MapObject,
  DrawingMode,
  Layer,
  MapPoint,
  MapCircle,
  MapPolyline,
  MapPolygon,
  LayerStyle,
} from "../types";
import {
  calculatePathLength,
  calculatePolygonArea,
  formatDistance,
  formatArea,
  getCentroid,
  calculateDistance,
  getObjectCenter,
} from "../utils/geoUtils";
import {
  createMarkerIcon,
  createMoveHandleIcon,
  createVertexIcon,
} from "./Icons";
import { Pencil, Trash2, Check } from "lucide-react";

// Limit vertices for showing edit handles to prevent crash on large imports (e.g. detailed country borders)
const VERTEX_LIMIT = 100;

interface MapBoardProps {
  layers: Layer[];
  activeLayerId: string;
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  objects: MapObject[];
  setObjects: React.Dispatch<React.SetStateAction<MapObject[]>>;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  rulerPoints: LatLngLiteral[];
  setRulerPoints: React.Dispatch<React.SetStateAction<LatLngLiteral[]>>;
  flyToTarget?: { id: string; time: number } | null;
  onObjectUpdate?: (updatedObject: MapObject) => void;
  onObjectDelete?: (id: string) => void;
  onNewObject?: (obj: MapObject) => void;
}

// --- Internal Components ---

const FlyToController = ({
  flyToTarget,
  objects,
}: {
  flyToTarget: { id: string; time: number } | null | undefined;
  objects: MapObject[];
}) => {
  const map = useMap();
  const lastFlyToTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only fly if we have a target and it's a new request (timestamp is newer than last handled)
    if (flyToTarget && flyToTarget.time > lastFlyToTimeRef.current) {
      const obj = objects.find((o) => o.id === flyToTarget.id);
      if (obj) {
        const center = getObjectCenter(obj);
        map.flyTo(center, 16, { duration: 1.5 });
        lastFlyToTimeRef.current = flyToTarget.time;
      }
    }
  }, [flyToTarget, objects, map]);

  return null;
};

interface ObjectPopupProps {
  obj: MapObject;
  updateObjectMeta: (id: string, title: string, desc: string) => void;
  onDelete: (id: string) => void;
  renderExtraView: () => React.ReactNode;
  renderExtraEdit?: () => React.ReactNode;
}

const ObjectPopup = ({
  obj,
  updateObjectMeta,
  onDelete,
  renderExtraView,
  renderExtraEdit,
}: ObjectPopupProps) => {
  const [isEditing, setIsEditing] = useState(false);

  // Reset editing state when object changes
  useEffect(() => {
    setIsEditing(false);
  }, [obj.id]);

  // Helper to render description with clickable links
  const renderDescription = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
        >
          {part}
        </a>
      ) : (
        part
      )
    );
  };

  return (
    <Popup minWidth={260} maxWidth={300}>
      <div
        className="flex flex-col gap-3 w-full font-sans"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {isEditing ? (
          // Edit Mode
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Title
              </label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                value={obj.title}
                onChange={(e) =>
                  updateObjectMeta(obj.id, e.target.value, obj.description)
                }
                placeholder="Title"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-all"
                rows={3}
                value={obj.description}
                onChange={(e) =>
                  updateObjectMeta(obj.id, obj.title, e.target.value)
                }
                placeholder="Description"
              />
            </div>

            {renderExtraEdit && renderExtraEdit()}

            <div className="flex justify-end pt-2 mt-1 border-t border-gray-100">
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Check size={14} />
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : (
          // View Mode
          <div className="flex flex-col gap-1">
            <div className="flex flex-col">
              <h3 className="font-bold text-lg text-gray-900 leading-tight">
                {obj.title || "Untitled"}
              </h3>
              {obj.description && (
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">
                  {renderDescription(obj.description)}
                </p>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100">
              {renderExtraView()}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200/60">
              <button
                onClick={() => onDelete(obj.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                title="Delete Object"
              >
                <Trash2 size={16} />
              </button>

              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all text-sm font-medium"
              >
                <Pencil size={14} />
                <span>Edit</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Popup>
  );
};

const RadiusInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    // Sync local state if external value changes significantly (e.g. from dragging)
    if (Math.abs(parseFloat(localValue || "0") - value) > 1) {
      setLocalValue(Math.round(value).toString());
    }
  }, [value, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    const val = parseFloat(newVal);
    if (!isNaN(val) && val > 0) {
      onChange(val);
    }
  };

  return (
    <div className="mt-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Radius (m)
      </label>
      <input
        type="number"
        min="1"
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={localValue}
        onChange={handleChange}
      />
    </div>
  );
};

interface MapObjectComponentProps {
  obj: any;
  style: LayerStyle;
  isSelected: boolean;
  drawingMode: DrawingMode;
  setSelectedObjectId: (id: string | null) => void;
  onUpdate: (id: string, updates: any) => void;
  updateObjectMeta: (id: string, title: string, desc: string) => void;
  onDelete: (id: string) => void;
}

const EditablePoint = ({
  obj,
  style,
  isSelected,
  drawingMode,
  setSelectedObjectId,
  onUpdate,
  updateObjectMeta,
  onDelete,
}: MapObjectComponentProps) => {
  return (
    <Marker
      position={obj.position}
      // Use borderColor as the main color for the point marker
      icon={createMarkerIcon(style.borderColor)}
      draggable={isSelected}
      interactive={drawingMode === "none"}
      eventHandlers={{
        click: () => {
          if (drawingMode === "none") setSelectedObjectId(obj.id);
        },
        dragend: (e) => onUpdate(obj.id, { position: e.target.getLatLng() }),
      }}
    >
      <ObjectPopup
        obj={obj}
        updateObjectMeta={updateObjectMeta}
        onDelete={onDelete}
        renderExtraView={() => (
          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded border border-gray-100">
            <div>Lat: {obj.position.lat.toFixed(6)}</div>
            <div>Lng: {obj.position.lng.toFixed(6)}</div>
          </div>
        )}
        renderExtraEdit={() => (
          <div className="text-xs text-gray-400 italic">
            Coordinates can be changed by dragging the pin.
          </div>
        )}
      />
    </Marker>
  );
};

const EditableCircle = ({
  obj,
  style,
  isSelected,
  drawingMode,
  setSelectedObjectId,
  onUpdate,
  updateObjectMeta,
  onDelete,
}: MapObjectComponentProps) => {
  const circleRef = useRef<L.Circle>(null);

  const onHandleDrag = (e: any) => {
    const newPos = e.target.getLatLng();
    if (circleRef.current) {
      circleRef.current.setLatLng(newPos);
    }
  };

  const onHandleDragEnd = (e: any) => {
    onUpdate(obj.id, { center: e.target.getLatLng() });
  };

  return (
    <>
      <Circle
        ref={circleRef}
        center={obj.center}
        radius={obj.radius}
        pathOptions={{
          color: style.borderColor,
          weight: style.borderWidth,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
        }}
        interactive={drawingMode === "none"}
        eventHandlers={{
          click: () => {
            if (drawingMode === "none") setSelectedObjectId(obj.id);
          },
        }}
      >
        <ObjectPopup
          obj={obj}
          updateObjectMeta={updateObjectMeta}
          onDelete={onDelete}
          renderExtraView={() => (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Radius:</span>
                <span className="font-medium text-blue-700">
                  {formatDistance(obj.radius)}
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">
                Center: {obj.center.lat.toFixed(5)}, {obj.center.lng.toFixed(5)}
              </div>
            </div>
          )}
          renderExtraEdit={() => (
            <RadiusInput
              value={obj.radius}
              onChange={(r) => onUpdate(obj.id, { radius: r })}
            />
          )}
        />
      </Circle>
      {isSelected && (
        <Marker
          position={obj.center}
          draggable={true}
          icon={createMoveHandleIcon()}
          eventHandlers={{
            drag: onHandleDrag,
            dragend: onHandleDragEnd,
          }}
        />
      )}
    </>
  );
};

const EditablePolyline = ({
  obj,
  style,
  isSelected,
  drawingMode,
  setSelectedObjectId,
  onUpdate,
  updateObjectMeta,
  onDelete,
}: MapObjectComponentProps) => {
  const polylineRef = useRef<L.Polyline>(null);
  const center = getCentroid(obj.positions);
  const distance = calculatePathLength(obj.positions);
  const showVertices = obj.positions.length <= VERTEX_LIMIT;

  const onVertexDrag = (idx: number, e: any) => {
    const newPos = e.target.getLatLng();
    if (polylineRef.current) {
      const currentLatLngs = [...obj.positions];
      currentLatLngs[idx] = newPos;
      polylineRef.current.setLatLngs(currentLatLngs);
    }
  };

  const onVertexDragEnd = (idx: number, e: any) => {
    const newPositions = [...obj.positions];
    newPositions[idx] = e.target.getLatLng();
    onUpdate(obj.id, { positions: newPositions });
  };

  const onCenterDrag = (e: any) => {
    const newCenter = e.target.getLatLng();
    const latDiff = newCenter.lat - center.lat;
    const lngDiff = newCenter.lng - center.lng;

    if (polylineRef.current) {
      const newPositions = obj.positions.map((p: LatLngLiteral) => ({
        lat: p.lat + latDiff,
        lng: p.lng + lngDiff,
      }));
      polylineRef.current.setLatLngs(newPositions);
    }
  };

  const onCenterDragEnd = (e: any) => {
    const newCenter = e.target.getLatLng();
    const latDiff = newCenter.lat - center.lat;
    const lngDiff = newCenter.lng - center.lng;
    const newPositions = obj.positions.map((p: LatLngLiteral) => ({
      lat: p.lat + latDiff,
      lng: p.lng + lngDiff,
    }));
    onUpdate(obj.id, { positions: newPositions });
  };

  return (
    <>
      <Polyline
        ref={polylineRef}
        positions={obj.positions}
        pathOptions={{
          color: style.borderColor,
          weight: isSelected
            ? Math.max(style.borderWidth + 2, 6)
            : style.borderWidth,
        }}
        interactive={drawingMode === "none"}
        eventHandlers={{
          click: () => {
            if (drawingMode === "none") setSelectedObjectId(obj.id);
          },
        }}
      >
        <ObjectPopup
          obj={obj}
          updateObjectMeta={updateObjectMeta}
          onDelete={onDelete}
          renderExtraView={() => (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Distance:</span>
              <span className="font-medium text-blue-700">
                {formatDistance(distance)}
              </span>
            </div>
          )}
          renderExtraEdit={() => (
            <div className="text-xs text-gray-400 italic">
              {showVertices
                ? "Drag points on map to edit path."
                : "Shape is too complex to edit individual points."}
            </div>
          )}
        />
      </Polyline>
      {isSelected && (
        <>
          {showVertices &&
            obj.positions.map((pos: LatLngLiteral, idx: number) => (
              <Marker
                key={`v-${idx}`}
                position={pos}
                icon={createVertexIcon()}
                draggable={true}
                eventHandlers={{
                  drag: (e) => onVertexDrag(idx, e),
                  dragend: (e) => onVertexDragEnd(idx, e),
                }}
              />
            ))}
          <Marker
            position={center}
            icon={createMoveHandleIcon()}
            draggable={true}
            eventHandlers={{
              drag: onCenterDrag,
              dragend: onCenterDragEnd,
            }}
          />
        </>
      )}
    </>
  );
};

const EditablePolygon = ({
  obj,
  style,
  isSelected,
  drawingMode,
  setSelectedObjectId,
  onUpdate,
  updateObjectMeta,
  onDelete,
}: MapObjectComponentProps) => {
  const polygonRef = useRef<L.Polygon>(null);
  const center = getCentroid(obj.positions);
  const area = calculatePolygonArea(obj.positions);
  const showVertices = obj.positions.length <= VERTEX_LIMIT;

  const onVertexDrag = (idx: number, e: any) => {
    const newPos = e.target.getLatLng();
    if (polygonRef.current) {
      const currentLatLngs = [...obj.positions];
      currentLatLngs[idx] = newPos;
      polygonRef.current.setLatLngs(currentLatLngs);
    }
  };

  const onVertexDragEnd = (idx: number, e: any) => {
    const newPositions = [...obj.positions];
    newPositions[idx] = e.target.getLatLng();
    onUpdate(obj.id, { positions: newPositions });
  };

  const onCenterDrag = (e: any) => {
    const newCenter = e.target.getLatLng();
    const latDiff = newCenter.lat - center.lat;
    const lngDiff = newCenter.lng - center.lng;

    if (polygonRef.current) {
      const newPositions = obj.positions.map((p: LatLngLiteral) => ({
        lat: p.lat + latDiff,
        lng: p.lng + lngDiff,
      }));
      polygonRef.current.setLatLngs(newPositions);
    }
  };

  const onCenterDragEnd = (e: any) => {
    const newCenter = e.target.getLatLng();
    const latDiff = newCenter.lat - center.lat;
    const lngDiff = newCenter.lng - center.lng;
    const newPositions = obj.positions.map((p: LatLngLiteral) => ({
      lat: p.lat + latDiff,
      lng: p.lng + lngDiff,
    }));
    onUpdate(obj.id, { positions: newPositions });
  };

  return (
    <>
      <Polygon
        ref={polygonRef}
        positions={obj.positions}
        pathOptions={{
          color: style.borderColor,
          weight: isSelected ? style.borderWidth + 2 : style.borderWidth,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
        }}
        interactive={drawingMode === "none"}
        eventHandlers={{
          click: () => {
            if (drawingMode === "none") setSelectedObjectId(obj.id);
          },
        }}
      >
        <ObjectPopup
          obj={obj}
          updateObjectMeta={updateObjectMeta}
          onDelete={onDelete}
          renderExtraView={() => (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Area:</span>
              <span className="font-medium text-blue-700">
                {formatArea(area)}
              </span>
            </div>
          )}
          renderExtraEdit={() => (
            <div className="text-xs text-gray-400 italic">
              {showVertices
                ? "Drag vertices on map to reshape."
                : "Shape is too complex to edit individual vertices."}
            </div>
          )}
        />
      </Polygon>
      {isSelected && (
        <>
          {showVertices &&
            obj.positions.map((pos: LatLngLiteral, idx: number) => (
              <Marker
                key={`v-${idx}`}
                position={pos}
                icon={createVertexIcon()}
                draggable={true}
                eventHandlers={{
                  drag: (e) => onVertexDrag(idx, e),
                  dragend: (e) => onVertexDragEnd(idx, e),
                }}
              />
            ))}
          <Marker
            position={center}
            icon={createMoveHandleIcon()}
            draggable={true}
            eventHandlers={{
              drag: onCenterDrag,
              dragend: onCenterDragEnd,
            }}
          />
        </>
      )}
    </>
  );
};

// --- Main Component ---

const MapEvents = ({
  drawingMode,
  setDrawingMode,
  activeLayerId,
  rulerPoints,
  setRulerPoints,
  selectedObjectId,
  setSelectedObjectId,
  onNewObject,
}: any) => {
  const map = useMap();
  const [tempPoints, setTempPoints] = useState<LatLngLiteral[]>([]);
  const [circleCenter, setCircleCenter] = useState<LatLngLiteral | null>(null);
  const [dragPoint, setDragPoint] = useState<LatLngLiteral | null>(null);

  // Clear temporary state when drawing mode changes
  useEffect(() => {
    if (drawingMode !== "circle") {
      setCircleCenter(null);
      setDragPoint(null);
    }
    if (drawingMode !== "polyline" && drawingMode !== "polygon") {
      setTempPoints([]);
    }
  }, [drawingMode]);

  // Click Handler
  useEffect(() => {
    const handleClick = (e: LeafletMouseEvent) => {
      if (drawingMode === "none") {
        setSelectedObjectId(null);
        return;
      }

      const { lat, lng } = e.latlng;
      const point = { lat, lng };

      if (drawingMode === "point") {
        const newPoint: MapPoint = {
          id: crypto.randomUUID(),
          layerId: activeLayerId,
          type: "point",
          title: "New Point",
          description: "No description",
          position: point,
        };
        onNewObject(newPoint);
        setDrawingMode("none");
      } else if (drawingMode === "circle") {
        if (!circleCenter) {
          setCircleCenter(point);
          setDragPoint(point);
        } else {
          const radius = calculateDistance(
            circleCenter.lat,
            circleCenter.lng,
            point.lat,
            point.lng
          );
          if (radius > 0) {
            const newCircle: MapCircle = {
              id: crypto.randomUUID(),
              layerId: activeLayerId,
              type: "circle",
              title: "New Circle",
              description: "No description",
              center: circleCenter,
              radius: radius,
            };
            onNewObject(newCircle);
          }
          setCircleCenter(null);
          setDragPoint(null);
          setDrawingMode("none");
        }
      } else if (drawingMode === "polyline" || drawingMode === "polygon") {
        setTempPoints((prev) => [...prev, point]);
      } else if (drawingMode === "ruler") {
        setRulerPoints((prev: LatLngLiteral[]) => [...prev, point]);
      }
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [
    map,
    drawingMode,
    circleCenter,
    activeLayerId,
    setDrawingMode,
    setSelectedObjectId,
    setRulerPoints,
    onNewObject,
  ]);

  // Mouse Move Handler (Only for Circle Preview)
  useEffect(() => {
    const handleMouseMove = (e: LeafletMouseEvent) => {
      if (drawingMode === "circle" && circleCenter) {
        setDragPoint(e.latlng);
      }
    };

    if (drawingMode === "circle" && circleCenter) {
      map.on("mousemove", handleMouseMove);
      return () => {
        map.off("mousemove", handleMouseMove);
      };
    }
  }, [map, drawingMode, circleCenter]);

  // Double Click Handler
  useEffect(() => {
    const handleDblClick = (e: LeafletMouseEvent) => {
      if (drawingMode === "polyline") {
        if (tempPoints.length > 1) {
          const newPolyline: MapPolyline = {
            id: crypto.randomUUID(),
            layerId: activeLayerId,
            type: "polyline",
            title: "New Line",
            description: "No description",
            positions: tempPoints,
          };
          onNewObject(newPolyline);
        }
        setTempPoints([]);
        setDrawingMode("none");
      } else if (drawingMode === "polygon") {
        if (tempPoints.length > 2) {
          const newPolygon: MapPolygon = {
            id: crypto.randomUUID(),
            layerId: activeLayerId,
            type: "polygon",
            title: "New Polygon",
            description: "No description",
            positions: tempPoints,
          };
          onNewObject(newPolygon);
        }
        setTempPoints([]);
        setDrawingMode("none");
      } else if (drawingMode === "ruler") {
        setDrawingMode("none");
      }
    };

    map.on("dblclick", handleDblClick);
    return () => {
      map.off("dblclick", handleDblClick);
    };
  }, [
    map,
    drawingMode,
    tempPoints,
    activeLayerId,
    setDrawingMode,
    onNewObject,
  ]);

  return (
    <>
      {/* Drawing Circle Preview */}
      {drawingMode === "circle" &&
        circleCenter &&
        dragPoint &&
        (() => {
          const radius = calculateDistance(
            circleCenter.lat,
            circleCenter.lng,
            dragPoint.lat,
            dragPoint.lng
          );
          return (
            <>
              <Circle
                center={circleCenter}
                radius={radius}
                pathOptions={{ color: "blue", dashArray: "5, 5", opacity: 0.6 }}
                interactive={false}
              />
              <Polyline
                positions={[circleCenter, dragPoint]}
                pathOptions={{
                  color: "blue",
                  dashArray: "5, 5",
                  weight: 1,
                  opacity: 0.5,
                }}
                interactive={false}
              />
              <Marker
                position={dragPoint}
                icon={createVertexIcon()}
                opacity={0}
                interactive={false}
              >
                <Tooltip permanent direction="right" offset={[10, 0]}>
                  Radius: {formatDistance(radius)}
                </Tooltip>
              </Marker>
            </>
          );
        })()}

      {/* Drawing Polyline/Polygon Preview */}
      {(drawingMode === "polyline" || drawingMode === "polygon") &&
        tempPoints.length > 0 && (
          <>
            {tempPoints.map((p, i) => (
              <Marker key={i} position={p} icon={createVertexIcon()} />
            ))}
            <Polyline
              positions={tempPoints}
              pathOptions={{ color: "blue", dashArray: "5, 5" }}
            />
          </>
        )}
    </>
  );
};

const MapBoard: React.FC<
  MapBoardProps & {
    onObjectUpdate?: (o: MapObject) => void;
    onObjectDelete?: (id: string) => void;
    onNewObject?: (o: MapObject) => void;
  }
> = ({
  layers,
  activeLayerId,
  drawingMode,
  setDrawingMode,
  objects,
  setObjects,
  selectedObjectId,
  setSelectedObjectId,
  rulerPoints,
  setRulerPoints,
  flyToTarget,
  onObjectUpdate,
  onObjectDelete,
  onNewObject,
}) => {
  const getLayerStyle = (layerId: string): LayerStyle => {
    const layer = layers.find((l) => l.id === layerId);
    return (
      layer?.style || {
        borderColor: "#3388ff",
        borderWidth: 2,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      }
    );
  };

  const isLayerVisible = (layerId: string) =>
    layers.find((l) => l.id === layerId)?.visible ?? true;

  const handleObjectUpdate = (id: string, updates: Partial<MapObject>) => {
    const target = objects.find((o) => o.id === id);
    if (!target) return;

    const updatedObject = { ...target, ...updates } as MapObject;

    // Optimistic UI Update
    setObjects((prev) => prev.map((o) => (o.id === id ? updatedObject : o)));

    // Persist
    if (onObjectUpdate) onObjectUpdate(updatedObject);
  };

  const updateObjectMeta = (id: string, title: string, desc: string) => {
    handleObjectUpdate(id, { title, description: desc });
  };

  const deleteObject = (id: string) => {
    // Optimistic UI Update
    setObjects((prev) => prev.filter((o) => o.id !== id));
    if (selectedObjectId === id) {
      setSelectedObjectId(null);
    }
    // Persist
    if (onObjectDelete) onObjectDelete(id);
  };

  const handleNewObject = (obj: MapObject) => {
    // Optimistic UI Update
    setObjects((prev) => [...prev, obj]);
    // Persist
    if (onNewObject) onNewObject(obj);
  };

  return (
    <div className="w-full h-full z-0">
      <MapContainer
        center={[1.3360910507988213, 103.83350372314455]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        doubleClickZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FlyToController flyToTarget={flyToTarget} objects={objects} />

        <MapEvents
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          activeLayerId={activeLayerId}
          setObjects={setObjects} // Passed for compatibility, but main handling via onNewObject
          rulerPoints={rulerPoints}
          setRulerPoints={setRulerPoints}
          selectedObjectId={selectedObjectId}
          setSelectedObjectId={setSelectedObjectId}
          onNewObject={handleNewObject}
        />

        {/* Render Objects */}
        {objects.map((obj) => {
          if (!isLayerVisible(obj.layerId)) return null;

          const isSelected = selectedObjectId === obj.id;
          const style = getLayerStyle(obj.layerId);

          // Interactive only when NOT in drawing mode
          const isInteractive = drawingMode === "none";

          const props = {
            // Force remount when interactivity needs to change.
            key: `${obj.id}-${isInteractive ? "interactive" : "static"}`,
            obj,
            style,
            isSelected,
            drawingMode,
            setSelectedObjectId,
            onUpdate: handleObjectUpdate,
            updateObjectMeta,
            onDelete: deleteObject,
          };

          if (obj.type === "point") return <EditablePoint {...props} />;
          if (obj.type === "circle") return <EditableCircle {...props} />;
          if (obj.type === "polyline") return <EditablePolyline {...props} />;
          if (obj.type === "polygon") return <EditablePolygon {...props} />;
          return null;
        })}

        {/* Ruler Overlay */}
        {rulerPoints.length > 0 && (
          <>
            {rulerPoints.map((p, i) => (
              <Marker key={`r-${i}`} position={p} icon={createVertexIcon()} />
            ))}
            <Polyline
              positions={rulerPoints}
              pathOptions={{ color: "black", dashArray: "10, 10", weight: 2 }}
            />
            {rulerPoints.length > 1 && (
              <Popup
                position={rulerPoints[rulerPoints.length - 1]}
                offset={[0, -10]}
              >
                <div className="text-sm font-bold">
                  Total: {formatDistance(calculatePathLength(rulerPoints))}
                </div>
              </Popup>
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default MapBoard;
