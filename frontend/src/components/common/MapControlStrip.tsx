import IconActionButton from './IconActionButton';

type MapControlStripProps = {
  mapName: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToMarkers: () => void;
  onResetExtent: () => void;
  onOpenFocus: () => void;
  fitToMarkersDisabled?: boolean;
};

function MapControlStrip({
  mapName,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToMarkers,
  onResetExtent,
  onOpenFocus,
  fitToMarkersDisabled = false,
}: MapControlStripProps) {
  return (
    <>
      <IconActionButton
        iconClassName="bi bi-zoom-in"
        tooltip={`Zoom in ${mapName}`}
        ariaLabel={`Zoom in ${mapName}`}
        onClick={onZoomIn}
        variant="outline-secondary"
      />
      <IconActionButton
        iconClassName="bi bi-zoom-out"
        tooltip={`Zoom out ${mapName}`}
        ariaLabel={`Zoom out ${mapName}`}
        onClick={onZoomOut}
        variant="outline-secondary"
      />
      <IconActionButton
        iconClassName="bi bi-aspect-ratio"
        tooltip="Reset map zoom"
        ariaLabel="Reset map zoom"
        onClick={onResetZoom}
        variant="outline-secondary"
      />
      <IconActionButton
        iconClassName="bi bi-bounding-box-circles"
        tooltip="Fit map to visible markers"
        ariaLabel="Fit map to visible markers"
        onClick={onFitToMarkers}
        variant="outline-secondary"
        disabled={fitToMarkersDisabled}
      />
      <IconActionButton
        iconClassName="bi bi-map"
        tooltip="Reset map extent"
        ariaLabel="Reset map extent"
        onClick={onResetExtent}
        variant="outline-secondary"
      />
      <IconActionButton
        iconClassName="bi bi-arrows-fullscreen"
        tooltip="Open focused full-screen map"
        ariaLabel="Open focused full-screen map"
        onClick={onOpenFocus}
        variant="outline-secondary"
      />
    </>
  );
}

export default MapControlStrip;
