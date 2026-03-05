# Route Map Feature - Quick Reference

## Access
- **URL**: `/route-map`
- **Permission**: `HOSTS_VIEW` (required)

## Test Data Available
### 5 Active Hosts with Coordinates (Atlanta Area)
1. **Chamblee/N Brookhaven** (ID: 42)
   - Location: Atlanta, GA
   - Coordinates: 33.8484, -84.3733

2. **Lilburn** (ID: 43)
   - Location: Roswell, GA
   - Coordinates: 34.0232, -84.3616

3. **Alpharetta** (ID: 55)
   - Coordinates: 34.0754, -84.2941

4. **Sandy Springs/Chastain** (ID: 58)
   - Coordinates: 33.9304, -84.3786

5. **Dunwoody** (ID: 59)
   - Coordinates: 33.9462, -84.3346

### Available Drivers
- Andrew McElroy (ID: 314)
- Brandon Graby (ID: 319)
- Caitlin Fitch (ID: 322)
- Bettina Smalley (ID: 326)
- Christian Rivers (ID: 330)

## Quick Test Steps
1. Login as admin
2. Navigate to `/route-map`
3. Select 3+ hosts using checkboxes
4. Choose a driver (optional)
5. Click "Optimize Route"
6. Verify route displays with numbered markers
7. Test: Export to Google Maps, Print, Copy to Clipboard

## API Endpoints

### Get Hosts for Map
```http
GET /api/hosts/map
Authorization: Required (HOSTS_VIEW)
```

**Response**: Array of hosts with coordinates
```json
[
  {
    "id": 42,
    "name": "Chamblee/N Brookhaven",
    "address": "Atlanta, GA",
    "latitude": "33.8484",
    "longitude": "-84.3733",
    "email": null,
    "phone": null
  }
]
```

### Optimize Route
```http
POST /api/routes/optimize
Authorization: Required (DRIVERS_VIEW)
Content-Type: application/json
```

**Request Body**:
```json
{
  "hostIds": [42, 43, 55, 58, 59],
  "driverId": "314"
}
```

**Response**:
```json
{
  "optimizedOrder": [
    {"id": 42, "name": "Chamblee/N Brookhaven", "position": 1},
    {"id": 59, "name": "Dunwoody", "position": 2},
    ...
  ],
  "totalDistance": 25.4,
  "unit": "miles",
  "driverId": "314",
  "algorithm": "nearest-neighbor"
}
```

### Update Host Coordinates
```http
PATCH /api/hosts/:id/coordinates
Authorization: Required (HOSTS_EDIT)
Content-Type: application/json
```

**Request Body**:
```json
{
  "latitude": 33.7490,
  "longitude": -84.3880
}
```

## Features Verified ✅
- ✅ Map displays with correct center
- ✅ Leaflet CSS loads properly
- ✅ Host markers display correctly
- ✅ Search/filter functionality
- ✅ Host selection (checkboxes)
- ✅ Driver dropdown
- ✅ Route optimization (nearest-neighbor)
- ✅ Polyline route display
- ✅ Numbered route markers
- ✅ Export to Google Maps
- ✅ Print route
- ✅ Copy to clipboard
- ✅ Permission controls
- ✅ Error handling
- ✅ Loading states
- ✅ Empty states

## Database Statistics
- **Total Active Hosts**: 12
- **Hosts with Coordinates**: 5 (42%)
- **Active Drivers**: 5

## Notes
- Only active hosts with valid coordinates appear on map
- Route optimization requires DRIVERS_VIEW permission
- Distance calculated using Haversine formula (miles)
- Algorithm: Nearest-neighbor (greedy approach)
