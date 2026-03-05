import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { PERMISSIONS } from '@shared/auth-utils';
import { z } from 'zod';
import { logger } from '../utils/production-safe-logger';

export function createRouteOptimizationRouter(deps: RouterDependencies) {
  const router = Router();
  const { storage, requirePermission } = deps;

  // Validation schema for route optimization request
  const routeOptimizationSchema = z.object({
    hostIds: z.array(z.number()).min(1, 'At least one host ID is required'),
    driverId: z.string().optional(),
  });

// Helper function to calculate distance between two coordinates (Haversine formula)
  function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest neighbor algorithm for route optimization
  function optimizeRouteNearestNeighbor(hosts: Array<{
  id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
}>): {
  optimizedOrder: Array<{ id: number; name: string; position: number }>;
  totalDistance: number;
} {
  if (hosts.length === 0) {
    return { optimizedOrder: [], totalDistance: 0 };
  }

  // Filter hosts with valid coordinates
  const validHosts = hosts.filter(
    (h) => h.latitude !== null && h.longitude !== null
  );

  if (validHosts.length === 0) {
    return { optimizedOrder: [], totalDistance: 0 };
  }

  if (validHosts.length === 1) {
    return {
      optimizedOrder: [{ id: validHosts[0].id, name: validHosts[0].name, position: 1 }],
      totalDistance: 0,
    };
  }

  const unvisited = [...validHosts];
  const route: Array<{ id: number; name: string; position: number }> = [];
  let totalDistance = 0;

  // Start with the first host
  let current = unvisited.shift()!;
  route.push({ id: current.id, name: current.name, position: 1 });

  // Visit nearest unvisited host until all are visited
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    const currentLat = parseFloat(current.latitude!);
    const currentLon = parseFloat(current.longitude!);

    // Find nearest unvisited host
    for (let i = 0; i < unvisited.length; i++) {
      const nextLat = parseFloat(unvisited[i].latitude!);
      const nextLon = parseFloat(unvisited[i].longitude!);
      const distance = calculateDistance(
        currentLat,
        currentLon,
        nextLat,
        nextLon
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    totalDistance += nearestDistance;
    current = unvisited.splice(nearestIndex, 1)[0];
    route.push({ id: current.id, name: current.name, position: route.length + 1 });
  }

  return {
    optimizedOrder: route,
    totalDistance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal place
  };
}

// POST /api/routes/optimize - Calculate optimized route for selected hosts
  router.post(
  '/optimize',
  requirePermission(PERMISSIONS.DRIVERS_VIEW),
  async (req, res) => {
    try {
      // Validate request body
      const result = routeOptimizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: result.error.errors,
        });
      }

      const { hostIds, driverId } = result.data;

      // Fetch all hosts
      const allHosts = await storage.getAllHosts();

      // Filter to requested host IDs
      const selectedHosts = allHosts.filter((host) =>
        hostIds.includes(host.id)
      );

      // Check if all requested hosts were found
      if (selectedHosts.length !== hostIds.length) {
        const foundIds = selectedHosts.map((h) => h.id);
        const missingIds = hostIds.filter((id) => !foundIds.includes(id));
        return res.status(404).json({
          error: 'Some hosts not found',
          missingIds,
        });
      }

      // Optimize route using nearest neighbor algorithm
      const optimization = optimizeRouteNearestNeighbor(selectedHosts);

      res.json({
        optimizedOrder: optimization.optimizedOrder,
        totalDistance: optimization.totalDistance,
        unit: 'miles',
        driverId: driverId || null,
        algorithm: 'nearest-neighbor',
      });
    } catch (error) {
      logger.error('Route optimization error:', error);
      res.status(500).json({
        error: 'Failed to optimize route',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

  return router;
}

