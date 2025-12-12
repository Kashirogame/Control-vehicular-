export enum SpotStatus {
  FREE = 'LIBRE',
  OCCUPIED = 'OCUPADO',
  VISITOR = 'VISITA'
}

export enum SpotType {
  NORMAL = 'NORMAL',
  DOUBLE = 'DOBLE'
}

export interface ParkingSpot {
  id: string; // PK, e.g., 'A1'
  status: SpotStatus;
  type: SpotType;
  assignedOffices?: string[]; // Offices that own this spot
  vehiclePlate?: string;
  visitorName?: string;
  timestamp?: number;
}

export interface Vehicle {
  plate: string; // PK
  office: string; // Changed from ownerName
  allowedSpots: string[]; // List of spot IDs this vehicle prefers or owns
}

export interface TransactionLog {
  id?: number;
  action: 'OCCUPY' | 'FREE';
  spotId: string;
  plate?: string;
  timestamp: number;
}