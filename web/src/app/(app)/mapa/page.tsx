import { MapView } from '@/components/map/MapView';

export default function MapaPage() {
  return (
    <div className="h-[calc(100vh-9rem)] overflow-hidden rounded-lg border">
      <MapView />
    </div>
  );
}
