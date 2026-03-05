import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './EditorMode.module.scss';
import clsx from 'clsx';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export interface ShapeDef {
  id: string;
  type: 'rect';
  /** Center X in CSS pixels relative to canvas top-left */
  x: number;
  /** Center Y in CSS pixels relative to canvas top-left */
  y: number;
  width: number;
  height: number;
  radius: number;
  roundness: number;
}

interface Props {
  shapes: ShapeDef[];
  onShapesChange: (shapes: ShapeDef[]) => void;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  canvasWidth: number;
  canvasHeight: number;
  lang: Record<string, any>;
}

type HandleDir =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

const HANDLE_SIZE = 8;
const MIN_SHAPE_SIZE = 20;

let nextShapeId = 1;
export function generateShapeId(): string {
  return `shape_${nextShapeId++}`;
}

export function createDefaultShape(canvasWidth: number, canvasHeight: number): ShapeDef {
  return {
    id: generateShapeId(),
    type: 'rect',
    x: canvasWidth / 2,
    y: canvasHeight / 2,
    width: 200,
    height: 200,
    radius: 80,
    roundness: 5,
  };
}

export const EditorMode = ({
  shapes,
  onShapesChange,
  selectedShapeId,
  onSelectShape,
  canvasWidth,
  canvasHeight,
  lang,
}: Props) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    type: 'move' | 'resize';
    shapeId: string;
    startMouseX: number;
    startMouseY: number;
    startShape: ShapeDef;
    handleDir?: HandleDir;
  } | null>(null);

  const [, forceUpdate] = useState(0);

  const selectedShape = shapes.find((s) => s.id === selectedShapeId) ?? null;

  const getShapeBounds = useCallback((shape: ShapeDef) => {
    return {
      left: shape.x - shape.width / 2,
      top: shape.y - shape.height / 2,
      right: shape.x + shape.width / 2,
      bottom: shape.y + shape.height / 2,
      width: shape.width,
      height: shape.height,
    };
  }, []);

  const hitTestShape = useCallback(
    (clientX: number, clientY: number): ShapeDef | null => {
      const overlay = overlayRef.current;
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Search in reverse order (top shapes first)
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        const bounds = getShapeBounds(shape);
        if (
          x >= bounds.left &&
          x <= bounds.right &&
          y >= bounds.top &&
          y <= bounds.bottom
        ) {
          return shape;
        }
      }
      return null;
    },
    [shapes, getShapeBounds],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Check if clicking a handle first (handled separately)
      const target = e.target as HTMLElement;
      if (target.dataset.handle) {
        return; // Handle resize start is handled by onHandlePointerDown
      }

      const hit = hitTestShape(e.clientX, e.clientY);
      if (hit) {
        onSelectShape(hit.id);
        // Start drag
        dragState.current = {
          type: 'move',
          shapeId: hit.id,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startShape: { ...hit },
        };
        e.preventDefault();
        e.stopPropagation();
      } else {
        onSelectShape(null);
      }
    },
    [hitTestShape, onSelectShape],
  );

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, dir: HandleDir) => {
      if (!selectedShape) return;
      e.preventDefault();
      e.stopPropagation();

      dragState.current = {
        type: 'resize',
        shapeId: selectedShape.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startShape: { ...selectedShape },
        handleDir: dir,
      };
    },
    [selectedShape],
  );

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;

      const dx = e.clientX - ds.startMouseX;
      const dy = e.clientY - ds.startMouseY;

      const shapeIndex = shapes.findIndex((s) => s.id === ds.shapeId);
      if (shapeIndex === -1) return;

      const newShapes = [...shapes];

      if (ds.type === 'move') {
        newShapes[shapeIndex] = {
          ...ds.startShape,
          x: ds.startShape.x + dx,
          y: ds.startShape.y + dy,
        };
      } else if (ds.type === 'resize' && ds.handleDir) {
        const s = ds.startShape;
        let newX = s.x;
        let newY = s.y;
        let newW = s.width;
        let newH = s.height;
        const dir = ds.handleDir;

        // Horizontal resize
        if (dir.includes('e')) {
          newW = Math.max(MIN_SHAPE_SIZE, s.width + dx);
          newX = s.x + (newW - s.width) / 2;
        } else if (dir.includes('w')) {
          newW = Math.max(MIN_SHAPE_SIZE, s.width - dx);
          newX = s.x - (newW - s.width) / 2;
        }

        // Vertical resize
        if (dir.includes('s')) {
          newH = Math.max(MIN_SHAPE_SIZE, s.height + dy);
          newY = s.y + (newH - s.height) / 2;
        } else if (dir.includes('n')) {
          newH = Math.max(MIN_SHAPE_SIZE, s.height - dy);
          newY = s.y - (newH - s.height) / 2;
        }

        newShapes[shapeIndex] = {
          ...s,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
      }

      onShapesChange(newShapes);
      forceUpdate((v) => v + 1);
    };

    const onPointerUp = () => {
      dragState.current = null;
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [shapes, onShapesChange]);

  const handleAddShape = useCallback(() => {
    if (shapes.length >= 8) return;
    const newShape = createDefaultShape(canvasWidth, canvasHeight);
    // Offset slightly so it doesn't overlap perfectly
    newShape.x += (shapes.length % 3) * 30 - 30;
    newShape.y += (shapes.length % 3) * 30 - 30;
    onShapesChange([...shapes, newShape]);
    onSelectShape(newShape.id);
  }, [shapes, onShapesChange, onSelectShape, canvasWidth, canvasHeight]);

  const handleDeleteShape = useCallback(() => {
    if (!selectedShapeId) return;
    const newShapes = shapes.filter((s) => s.id !== selectedShapeId);
    onShapesChange(newShapes);
    onSelectShape(newShapes.length > 0 ? newShapes[newShapes.length - 1].id : null);
  }, [shapes, selectedShapeId, onShapesChange, onSelectShape]);

  const handleDirs: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const getHandlePosition = (dir: HandleDir, bounds: ReturnType<typeof getShapeBounds>) => {
    const hx =
      dir.includes('w') ? bounds.left : dir.includes('e') ? bounds.right : bounds.left + bounds.width / 2;
    const hy =
      dir.includes('n') ? bounds.top : dir.includes('s') ? bounds.bottom : bounds.top + bounds.height / 2;
    return { x: hx, y: hy };
  };

  const getHandleCursor = (dir: HandleDir) => {
    const map: Record<HandleDir, string> = {
      nw: 'nwse-resize',
      n: 'ns-resize',
      ne: 'nesw-resize',
      e: 'ew-resize',
      se: 'nwse-resize',
      s: 'ns-resize',
      sw: 'nesw-resize',
      w: 'ew-resize',
    };
    return map[dir];
  };

  return (
    <div className={styles.editorOverlay}>
      {/* Interaction area over canvas */}
      <div
        ref={overlayRef}
        className={styles.canvasOverlay}
        style={{ width: canvasWidth, height: canvasHeight }}
        onPointerDown={handlePointerDown}
      >
        {/* Bounding boxes for all shapes */}
        {shapes.map((shape) => {
          const bounds = getShapeBounds(shape);
          const isSelected = shape.id === selectedShapeId;
          return (
            <div
              key={shape.id}
              className={clsx(styles.shapeBounds, {
                [styles.shapeBoundsSelected]: isSelected,
              })}
              style={{
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
              }}
            >
              {/* Resize handles for selected shape */}
              {isSelected &&
                handleDirs.map((dir) => {
                  const pos = getHandlePosition(dir, {
                    left: 0,
                    top: 0,
                    right: bounds.width,
                    bottom: bounds.height,
                    width: bounds.width,
                    height: bounds.height,
                  });
                  return (
                    <div
                      key={dir}
                      data-handle={dir}
                      className={styles.resizeHandle}
                      style={{
                        left: pos.x - HANDLE_SIZE / 2,
                        top: pos.y - HANDLE_SIZE / 2,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        cursor: getHandleCursor(dir),
                      }}
                      onPointerDown={(e) => onHandlePointerDown(e, dir)}
                    />
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Shape list panel */}
      <div className={styles.shapePanel}>
        <div className={styles.shapePanelHeader}>
          <span className={styles.shapePanelTitle}>{lang['editor.shapeList']}</span>
          <div className={styles.shapePanelActions}>
            <button
              className={styles.iconButton}
              onClick={handleAddShape}
              disabled={shapes.length >= 8}
              title={lang['editor.addShape']}
            >
              <AddIcon style={{ fontSize: 16 }} />
            </button>
            <button
              className={styles.iconButton}
              onClick={handleDeleteShape}
              disabled={!selectedShapeId || shapes.length <= 1}
              title={lang['editor.deleteShape']}
            >
              <DeleteOutlineIcon style={{ fontSize: 16 }} />
            </button>
          </div>
        </div>
        <div className={styles.shapeList}>
          {shapes.map((shape, index) => (
            <div
              key={shape.id}
              className={clsx(styles.shapeListItem, {
                [styles.shapeListItemSelected]: shape.id === selectedShapeId,
              })}
              onClick={() => onSelectShape(shape.id)}
            >
              <span className={styles.shapeListItemIcon}>&#9645;</span>
              <span>
                {lang['editor.shape']} {index + 1}
              </span>
              <span className={styles.shapeListItemSize}>
                {Math.round(shape.width)}x{Math.round(shape.height)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
