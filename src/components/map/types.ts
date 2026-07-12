/** Minimal POI shape shared by the editor and the public viewer. */
export interface PoiData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  lat: number;
  lng: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}
