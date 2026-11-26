/**
 * ============================================================================
 * QUÉ HACE:
 * Entrega un catálogo de demostración con 8 productos variados (gomitas dulces,
 * gomitas ácidas, maní dulce y maní salado) para desarrollar y probar la web
 * localmente antes de conectar Google Sheets + PHP Proxy.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Agrega, modifica o desactiva productos demo para probar filtros, stock
 *   agotado (`stockGramos: 0`) o rutas de imágenes locales.
 * - Cuando subas tus imágenes reales a `public/images/productos/`, verifica
 *   que coincidan los nombres con `imgCalcomania` e `imgProducto`.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Implementa el tipo `ProductDTO` de `src/contracts/catalogo.contract.ts`.
 * - Usado como respaldo automático por `gestion-datos` cuando no hay conexión
 *   con `/api/catalogo.php`.
 * ============================================================================
 */
import type { ProductDTO } from '../contracts/catalogo.contract';

export const MOCK_CATALOGO: ProductDTO[] = [
  // --- GOMITAS DULCES ---
  {
    id: 'gom-ositos-clasicos',
    nombre: 'Ositos Frutales Clásicos',
    tipo: 'gomita',
    categoria: 'dulce',
    stockGramos: 3500,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/gom-ositos-clasicos.png',
    imgProducto: '/images/productos/fotos/gom-ositos-clasicos.png',
  },
  {
    id: 'gom-tiburones-azules',
    nombre: 'Tiburones Azules',
    tipo: 'gomita',
    categoria: 'dulce',
    stockGramos: 2200,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/gom-tiburones-azules.png',
    imgProducto: '/images/productos/fotos/gom-tiburones-azules.png',
  },

  // --- GOMITAS ÁCIDAS ---
  {
    id: 'gom-aros-durazno-acido',
    nombre: 'Aros de Durazno Ácidos',
    tipo: 'gomita',
    categoria: 'acido',
    stockGramos: 1800,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/gom-aros-durazno-acido.png',
    imgProducto: '/images/productos/fotos/gom-aros-durazno-acido.png',
  },
  {
    id: 'gom-gusanos-acidos',
    nombre: 'Gusanitos Neón Ácidos',
    tipo: 'gomita',
    categoria: 'acido',
    stockGramos: 950,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/gom-gusanos-acidos.png',
    imgProducto: '/images/productos/fotos/gom-gusanos-acidos.png',
  },

  // --- MANÍ DULCE (Mezclable con gomitas dulces y ácidas) ---
  {
    id: 'man-confitado-platano',
    nombre: 'Maní Confitado Plátano',
    tipo: 'mani',
    categoria: 'dulce',
    stockGramos: 2600,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/man-confitado-platano.png',
    imgProducto: '/images/productos/fotos/man-confitado-platano.png',
  },
  {
    id: 'man-confitado-durazno',
    nombre: 'Maní Confitado Durazno',
    tipo: 'mani',
    categoria: 'dulce',
    stockGramos: 1400,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/man-confitado-durazno.png',
    imgProducto: '/images/productos/fotos/man-confitado-durazno.png',
  },

  // --- MANÍ SALADO (Solo mezclable con otros salados) ---
  {
    id: 'man-japones-clasico',
    nombre: 'Maní Japonés Clásico',
    tipo: 'mani',
    categoria: 'salado',
    stockGramos: 3200,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/man-japones-clasico.png',
    imgProducto: '/images/productos/fotos/man-japones-clasico.png',
  },
  {
    id: 'man-salado-merken',
    nombre: 'Maní Salado Merkén',
    tipo: 'mani',
    categoria: 'salado',
    stockGramos: 1600,
    activo: true,
    imgCalcomania: '/images/productos/calcomanias/man-salado-merken.png',
    imgProducto: '/images/productos/fotos/man-salado-merken.png',
  },
];
