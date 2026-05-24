export interface VinDecodeRequest {
  vin: string;
  modelYear?: string | number;
}

export interface NormalizedDecodedVehicle {
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
  bodyClass: string | null;
  fuelType: string | null;
  driveType: string | null;
  manufacturer: string | null;
  raw: unknown;
}

export interface VinDecoderProvider {
  decodeVin(request: VinDecodeRequest): Promise<NormalizedDecodedVehicle>;
}

