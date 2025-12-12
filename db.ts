import Dexie, { type Table } from 'dexie';
import { ParkingSpot, SpotStatus, SpotType, Vehicle, TransactionLog } from './types';

export class SmartParkDB extends Dexie {
  parkingSpots!: Table<ParkingSpot, string>;
  vehicles!: Table<Vehicle, string>;
  logs!: Table<TransactionLog, number>;

  constructor() {
    super('SmartParkV2DB');
    
    // VERSION 1
    (this as any).version(1).stores({
      parkingSpots: 'id, status, vehiclePlate',
      vehicles: 'plate',
      logs: '++id, spotId, timestamp'
    });

    // VERSION 2: Add multi-entry index for allowedSpots
    (this as any).version(2).stores({
      parkingSpots: 'id, status, vehiclePlate',
      vehicles: 'plate, *allowedSpots', // Index allowedSpots array
      logs: '++id, spotId, timestamp'
    });

    (this as any).on('populate', this.populate);
  }

  populate = async () => {
    // --- GENERATE 155 SPOTS ---
    const spots: ParkingSpot[] = [];
    const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
    const COLS_PER_ROW = 10;
    const TOTAL_SPOTS = 155;
    
    let spotCount = 0;
    let rowIndex = 0;

    while (spotCount < TOTAL_SPOTS) {
      const rowChar = rows[rowIndex] || 'Z';
      for (let i = 1; i <= COLS_PER_ROW; i++) {
        if (spotCount >= TOTAL_SPOTS) break;

        const id = `${rowChar}${i}`;
        
        // Mock Data Logic
        const isDouble = i % 8 === 0; // Every 8th spot is double
        const officeNum = Math.floor(Math.random() * 20) + 1; // Offices 1-20
        const assignedOffices = [`Oficina ${officeNum}`];
        
        // Add shared office sometimes
        if (Math.random() > 0.9) {
             assignedOffices.push(`Oficina ${officeNum + 1}`);
        }

        spots.push({
          id: id,
          status: SpotStatus.FREE,
          type: isDouble ? SpotType.DOUBLE : SpotType.NORMAL,
          assignedOffices: assignedOffices
        });

        spotCount++;
      }
      rowIndex++;
    }

    await this.parkingSpots.bulkAdd(spots);

    // --- GENERATE 200 VEHICLES ---
    const vehicles: Vehicle[] = [];
    const TOTAL_VEHICLES = 200;

    for (let i = 1; i <= TOTAL_VEHICLES; i++) {
      // Generate Plate: TST-001, TST-002...
      const num = i.toString().padStart(3, '0');
      const plate = `TST-${num}`;
      
      // Assign random office
      const officeNum = Math.floor(Math.random() * 20) + 1;
      const office = `Oficina ${officeNum}`;

      // Assign random spots (1 or 2) from the created spots
      const numAllowed = Math.random() > 0.9 ? 2 : 1;
      const allowedSpots: string[] = [];
      
      for (let j = 0; j < numAllowed; j++) {
         const randomSpot = spots[Math.floor(Math.random() * spots.length)];
         if (randomSpot && !allowedSpots.includes(randomSpot.id)) {
             allowedSpots.push(randomSpot.id);
         }
      }

      vehicles.push({
        plate: plate,
        office: office,
        allowedSpots: allowedSpots
      });
    }

    await this.vehicles.bulkAdd(vehicles);
    
    console.log(`Base de datos poblada con ${spots.length} parqueaderos y ${vehicles.length} vehículos.`);
  };

  // ATOMIC TRANSACTION: Occupy a spot
  async occupySpot(spotId: string, plate: string, isVisitor: boolean, visitorName?: string) {
    return (this as any).transaction('rw', this.parkingSpots, this.logs, async () => {
      const targetSpot = await this.parkingSpots.get(spotId);
      if (!targetSpot) throw new Error('El puesto no existe');
      if (targetSpot.status !== SpotStatus.FREE) throw new Error('El puesto ya está ocupado');

      const cleanPlate = plate.toUpperCase().trim();

      // LOGIC: One Vehicle = One Spot.
      // Check if this plate is already parked somewhere else
      const existingSpot = await this.parkingSpots.where('vehiclePlate').equals(cleanPlate).first();

      if (existingSpot) {
        // If it's the same spot (shouldn't happen due to status check, but safety first)
        if (existingSpot.id === spotId) return;

        // Free the old spot automatically
        const freedSpot: ParkingSpot = {
          id: existingSpot.id,
          type: existingSpot.type,
          assignedOffices: existingSpot.assignedOffices,
          status: SpotStatus.FREE
        };
        await this.parkingSpots.put(freedSpot);
        
        // Log the auto-release
        await this.logs.add({
          action: 'FREE',
          spotId: existingSpot.id,
          plate: cleanPlate,
          timestamp: Date.now()
        });
      }

      // Occupy the new spot
      const updatedSpot: ParkingSpot = {
        id: targetSpot.id,
        type: targetSpot.type,
        assignedOffices: targetSpot.assignedOffices, // Preserve assigned offices
        status: isVisitor ? SpotStatus.VISITOR : SpotStatus.OCCUPIED,
        vehiclePlate: cleanPlate,
        visitorName: isVisitor ? visitorName : undefined,
        timestamp: Date.now()
      };

      await this.parkingSpots.put(updatedSpot);
      
      await this.logs.add({
        action: 'OCCUPY',
        spotId,
        plate: cleanPlate,
        timestamp: Date.now()
      });
    });
  }

  // ATOMIC TRANSACTION: Free a spot
  async freeSpot(spotId: string) {
    return (this as any).transaction('rw', this.parkingSpots, this.logs, async () => {
      const spot = await this.parkingSpots.get(spotId);
      if (!spot) throw new Error('Spot not found');

      // STRATEGY: Overwrite with a clean object to avoid ghost data
      const cleanSpot: ParkingSpot = {
        id: spot.id,
        type: spot.type,
        assignedOffices: spot.assignedOffices, // Preserve assigned offices
        status: SpotStatus.FREE
        // Explicitly undefined fields are not included in the object
      };

      await this.parkingSpots.put(cleanSpot);

      await this.logs.add({
        action: 'FREE',
        spotId,
        plate: spot.vehiclePlate,
        timestamp: Date.now()
      });
    });
  }

  // ATOMIC TRANSACTION: Delete Spots and Linked Vehicles
  async deleteSpots(spotIds: string[]) {
    return (this as any).transaction('rw', this.parkingSpots, this.vehicles, this.logs, async () => {
      for (const spotId of spotIds) {
        // 1. Find vehicles authorized for this spot using the new MultiEntry Index
        const linkedVehicles = await this.vehicles.where('allowedSpots').equals(spotId).toArray();
        
        // 2. Delete those vehicles (as requested: "elimine tambien de la base de datos")
        if (linkedVehicles.length > 0) {
          const platesToDelete = linkedVehicles.map(v => v.plate);
          await this.vehicles.bulkDelete(platesToDelete);
        }

        // 3. Delete the spot itself
        await this.parkingSpots.delete(spotId);
      }
    });
  }
}

export const db = new SmartParkDB();