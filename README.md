# 🏨 Hotel Price Shopper

Dashboard para comparar tarifas diarias de hoteles en Booking.com usando RapidAPI.

## Arquitectura

```
Browser → /api/rooms (Vercel serverless) → RapidAPI → respuesta
```

La API key vive **solo en el servidor** (variable de entorno Vercel). El browser nunca la ve.

## Setup local

```bash
npm install
cp .env.example .env.local
# Editá .env.local y pegá tu RAPIDAPI_KEY
npx vercel dev
```

Abrí http://localhost:3000

## Deploy en Vercel

1. Subí este repo a GitHub
2. Importalo en vercel.com → "Add New Project"
3. En **Environment Variables** agregá:
   - `RAPIDAPI_KEY` = tu key de RapidAPI
4. Deploy ✓

## Hotel IDs

Para encontrar el ID de un hotel:
1. Abrí la página del hotel en Booking.com
2. Ctrl+U (ver código fuente)
3. Buscá `hotel_id` → el número es el ID

Hoteles pre-cargados (Ushuaia):
- Lennox Hotel: `186029`
- Canal Beagle: (buscar)
- Hotel Albatros: (buscar)
- Cilene del Fuego: (buscar)
