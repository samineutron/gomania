/**
 * ============================================================================
 * QUÉ HACE:
 * Funciones puras (sin DOM, sin red ni frameworks) con todas las reglas de
 * negocio inmutables del módulo `mix-builder` de GoManía SpA:
 * - Consulta y validación de tramos fijos (`80g` a `3kg`).
 * - Regla estricta de compatibilidad: `dulce` y `acido` SÍ se mezclan
 *   (gomitas y maní); `salado` NUNCA se mezcla con `dulce` ni `acido`.
 * - Regla de unicidad: cada sabor se puede marcar máximo 1 vez por bolsa.
 * - Reparto equitativo de gramos por sabor (con ajuste de residuo documentado).
 * - Validación de stock disponible en gramos tanto al agregar como al cerrar.
 * - Construcción tipada de `MixContextDTO` y `MixItemDTO`.
 *
 * QUÉ PUEDES EDITAR AQUÍ:
 * - Los precios, pesos y cupos máximos vienen centralizados desde `BAG_TIERS`
 *   en `src/shared/config.ts` (edítalos allá si cambian en el futuro).
 * - Los textos de validación si deseas ajustar el tono de las alertas.
 *
 * CON QUÉ MÓDULO CONECTA:
 * - Consume contratos `ProductDTO` y `ProductCategory`
 *   (`src/contracts/catalogo.contract.ts`).
 * - Consume contratos `BagSizeId`, `BagTierDTO`, `MixContextDTO`,
 *   `MixFlavorDTO`, `MixItemDTO`, `MixProfile`
 *   (`src/contracts/mix-builder.contract.ts`).
 * - Consume `BAG_TIERS` (`src/shared/config.ts`).
 * ============================================================================
 */
import type {
  ProductCategory,
  ProductDTO,
} from '../../../contracts/catalogo.contract';
import type {
  BagSizeId,
  BagTierDTO,
  MixContextDTO,
  MixFlavorDTO,
  MixItemDTO,
  MixProfile,
} from '../../../contracts/mix-builder.contract';
import { BAG_TIERS } from '../../../shared/config';

/** Mínimo absoluto de stock en gramos para poder vender un sabor (tramo 80 g). */
export const MIN_SELLABLE_STOCK_GRAMS = 80;

/** Códigos estructurados de validación para que la UI reaccione sin acoplar textos. */
export type MixValidationErrorCode =
  | 'TIER_REQUIRED'
  | 'PROFILE_REQUIRED'
  | 'OUT_OF_STOCK'
  | 'DUPLICATE_FLAVOR'
  | 'INCOMPATIBLE_PROFILE'
  | 'MAX_FLAVORS_REACHED'
  | 'INSUFFICIENT_STOCK';

/** Resultado de validar la incorporación de un sabor candidato al mix actual. */
export interface FlavorValidationResult {
  ok: boolean;
  code: MixValidationErrorCode | null;
  message: string | null;
}

/** Detalle de déficit de stock cuando un sabor elegido necesita más gramos de los disponibles. */
export interface FlavorStockIssue {
  productId: string;
  nombre: string;
  requiredGrams: number;
  availableGrams: number;
}

/** Resultado completo de validar si el mix está listo para añadirse al carrito. */
export interface MixCartValidationResult {
  canSubmit: boolean;
  reason: string | null;
  stockIssues: FlavorStockIssue[];
}

/** Etiquetas legibles de cada perfil de mezcla. */
export const MIX_PROFILE_LABELS: Record<MixProfile, string> = {
  libre: 'Sabor individual',
  'dulce-acido': 'Mix Dulce / Ácido',
  salado: 'Mix Salado',
};

/**
 * Busca la configuración oficial de un tramo fijo (`80g`, `500g`, `1kg`, `2kg`, `3kg`)
 * desde la tabla inmutable `BAG_TIERS` en `src/shared/config.ts`.
 */
export function getBagTierById(tierId: BagSizeId): BagTierDTO {
  const found = BAG_TIERS.find((tier) => tier.id === tierId);
  if (!found) {
    // Respaldo seguro al primer tramo (`80g`) si llegara un ID inesperado
    return BAG_TIERS[0];
  }
  return found;
}

/**
 * Retorna `true` si el formato es la bolsita individual de 80 g (Doypack dinámico).
 */
export function isDoypackTier(tier: BagTierDTO | null): boolean {
  return tier !== null && tier.bagStyle === 'doypack';
}

/**
 * Retorna `true` si el formato exige elegir perfil obligatorio antes de seleccionar sabores.
 * Regla de negocio: todo tramo de `500g` o más (`500g`, `1kg`, `2kg`, `3kg`) exige elegir
 * entre `Mix Dulce / Ácido` o `Mix Salado`.
 */
export function requiresProfileSelection(tier: BagTierDTO | null): boolean {
  return tier !== null && tier.grams >= 500;
}

/**
 * Valida si la categoría de un producto (`dulce`, `acido`, `salado`) es compatible
 * con el perfil elegido en la bolsa.
 * - `libre` (80g): acepta dulce, ácido o salado (gomitas y maní).
 * - `dulce-acido`: acepta `dulce` y `acido`, bloquea `salado`.
 * - `salado`: acepta únicamente `salado`, bloquea `dulce` y `acido`.
 */
export function isCategoryCompatibleWithProfile(
  categoria: ProductCategory,
  profile: MixProfile
): boolean {
  if (profile === 'libre') return true;
  if (profile === 'dulce-acido') {
    return categoria === 'dulce' || categoria === 'acido';
  }
  return categoria === 'salado';
}

/**
 * Verifica compatibilidad directa entre dos categorías de producto.
 * Regla inmutable: `salado` jamás se mezcla con `dulce` ni `acido`.
 */
export function areCategoriesMutuallyCompatible(
  catA: ProductCategory,
  catB: ProductCategory
): boolean {
  const aIsSalty = catA === 'salado';
  const bIsSalty = catB === 'salado';
  return aIsSalty === bIsSalty;
}

/**
 * Calcula los gramos base equitativos por sabor para mostrar en la barra de progreso.
 * Fórmula: `Math.floor(totalGramos / cantidadSabores)`.
 * Ejemplo: 1.000 g con 5 sabores -> 200 g c/u; 500 g con 2 sabores -> 250 g c/u.
 */
export function calculateEquitableGramsPerFlavor(
  totalGrams: number,
  flavorCount: number
): number {
  if (totalGrams <= 0 || flavorCount <= 0) return 0;
  return Math.floor(totalGrams / flavorCount);
}

/**
 * Reparte los gramos totales de forma equitativa devolviendo un arreglo exacto
 * por cada sabor elegido.
 *
 * REGLA DE AJUSTE DE RESIDUO (documentada):
 * - Cada sabor recibe primero `base = Math.floor(totalGrams / flavorCount)`.
 * - Si la división no es exacta (ej. `500g / 3 = 166g` con residuo `2g`),
 *   el residuo `totalGrams % flavorCount` se distribuye sumando `+1g` a los
 *   primeros sabores seleccionados (`[167, 167, 166]`), garantizando que la
 *   suma total siempre coincida exactamente con el peso de la bolsa.
 */
export function distributeGramsEquitably(
  totalGrams: number,
  flavorCount: number
): number[] {
  if (totalGrams <= 0 || flavorCount <= 0) return [];
  const base = Math.floor(totalGrams / flavorCount);
  const remainder = totalGrams % flavorCount;

  const result: number[] = [];
  for (let i = 0; i < flavorCount; i++) {
    result.push(i < remainder ? base + 1 : base);
  }
  return result;
}

/**
 * Calcula el piso mínimo de stock que necesita un sabor para poder entrar
 * en un tramo (suponiendo que la bolsa se llene hasta su tope de sabores).
 * Ejemplo: 80g -> 80g; 500g -> 166g; 1kg -> 200g; 2kg -> 200g; 3kg -> 200g.
 */
export function getMinPossibleGramsForTier(tier: BagTierDTO): number {
  const minSlice = Math.floor(tier.grams / Math.max(1, tier.maxFlavors));
  return Math.max(MIN_SELLABLE_STOCK_GRAMS, minSlice);
}

/**
 * Valida si un producto candidato del catálogo puede agregarse al mix actual.
 * Revisa en orden: formato activo, perfil obligatorio, disponibilidad/stock,
 * unicidad (máx. 1 vez), compatibilidad Dulce/Ácido vs. Salado y cupo máximo.
 */
export function validateFlavorAddition(params: {
  tier: BagTierDTO | null;
  profile: MixProfile | null;
  selectedFlavors: ProductDTO[];
  candidate: ProductDTO;
}): FlavorValidationResult {
  const { tier, profile, selectedFlavors, candidate } = params;

  // 1. Debe existir un tramo elegido
  if (!tier) {
    return {
      ok: false,
      code: 'TIER_REQUIRED',
      message: 'Primero elige un formato de bolsa (80 g a 3 kg).',
    };
  }

  // 2. En tramos >= 500 g es obligatorio elegir perfil antes de agregar sabores
  if (requiresProfileSelection(tier) && (!profile || profile === 'libre')) {
    return {
      ok: false,
      code: 'PROFILE_REQUIRED',
      message:
        'Antes de elegir sabores, selecciona si tu bolsa será Mix Dulce / Ácido o Mix Salado.',
    };
  }

  // 3. Producto activo y con stock mínimo global
  if (!candidate.activo || candidate.stockGramos < MIN_SELLABLE_STOCK_GRAMS) {
    return {
      ok: false,
      code: 'OUT_OF_STOCK',
      message: `${candidate.nombre} está agotado por el momento.`,
    };
  }

  // 4. Unicidad estricta: cada sabor se marca máximo 1 vez por bolsa
  if (selectedFlavors.some((item) => item.id === candidate.id)) {
    return {
      ok: false,
      code: 'DUPLICATE_FLAVOR',
      message: `${candidate.nombre} ya está en tu bolsa. Cada sabor se puede elegir solo una vez.`,
    };
  }

  // 5. Regla estricta Dulce/Ácido vs. Salado (tanto contra perfil como contra elegidos)
  const effectiveProfile: MixProfile = profile ?? 'libre';
  if (!isCategoryCompatibleWithProfile(candidate.categoria, effectiveProfile)) {
    return {
      ok: false,
      code: 'INCOMPATIBLE_PROFILE',
      message:
        effectiveProfile === 'salado'
          ? `No puedes mezclar ${candidate.nombre} en un Mix Salado.`
          : `No puedes mezclar ${candidate.nombre} (salado) en un Mix Dulce / Ácido.`,
    };
  }

  const hasMutualConflict = selectedFlavors.some(
    (item) => !areCategoriesMutuallyCompatible(item.categoria, candidate.categoria)
  );
  if (hasMutualConflict) {
    return {
      ok: false,
      code: 'INCOMPATIBLE_PROFILE',
      message: 'No se pueden mezclar sabores salados con dulces o ácidos en la misma bolsa.',
    };
  }

  // 6. Cupo máximo de sabores del tramo
  if (selectedFlavors.length >= tier.maxFlavors) {
    return {
      ok: false,
      code: 'MAX_FLAVORS_REACHED',
      message:
        tier.maxFlavors === 1
          ? `La bolsita de ${tier.label} lleva exactamente 1 sabor. Quita el actual si deseas cambiarlo.`
          : `Ya alcanzaste el máximo de ${tier.maxFlavors} sabores para la bolsa de ${tier.label}.`,
    };
  }

  // 7. Stock suficiente: nunca puede ser menor al mínimo posible del tramo
  const minTierGrams = getMinPossibleGramsForTier(tier);
  if (candidate.stockGramos < minTierGrams) {
    return {
      ok: false,
      code: 'INSUFFICIENT_STOCK',
      message: `${candidate.nombre} tiene solo ${candidate.stockGramos} g disponibles y el formato ${tier.label} requiere al menos ${minTierGrams} g por sabor.`,
    };
  }

  // Si con este sabor se completa el cupo máximo, validamos contra el reparto exacto final
  const nextCount = selectedFlavors.length + 1;
  if (nextCount === tier.maxFlavors) {
    const finalDistribution = distributeGramsEquitably(tier.grams, nextCount);
    const candidateGrams = finalDistribution[nextCount - 1];
    if (candidate.stockGramos < candidateGrams) {
      return {
        ok: false,
        code: 'INSUFFICIENT_STOCK',
        message: `${candidate.nombre} tiene ${candidate.stockGramos} g disponibles, pero necesita ${candidateGrams} g para completar esta bolsa.`,
      };
    }
  }

  return {
    ok: true,
    code: null,
    message: null,
  };
}

/**
 * Revisa si alguno de los sabores actualmente seleccionados supera su `stockGramos`
 * con el reparto equitativo actual (por ejemplo, si el cliente eligió 1 solo sabor
 * en una bolsa de 1 kg y ese sabor tiene 600 g de stock).
 */
export function findMixStockIssues(
  tier: BagTierDTO | null,
  selectedFlavors: ProductDTO[]
): FlavorStockIssue[] {
  if (!tier || selectedFlavors.length === 0) return [];

  const distribution = distributeGramsEquitably(tier.grams, selectedFlavors.length);
  const issues: FlavorStockIssue[] = [];

  for (let i = 0; i < selectedFlavors.length; i++) {
    const flavor = selectedFlavors[i];
    const requiredGrams = distribution[i];
    if (flavor.stockGramos < requiredGrams) {
      issues.push({
        productId: flavor.id,
        nombre: flavor.nombre,
        requiredGrams,
        availableGrams: flavor.stockGramos,
      });
    }
  }

  return issues;
}

/**
 * Valida integralmente si el mix actual cumple todas las reglas de permisos
 * y negocio para habilitar el botón "Añadir al carrito" (o "Guardar cambios").
 */
export function validateMixForCart(params: {
  tier: BagTierDTO | null;
  profile: MixProfile | null;
  selectedFlavors: ProductDTO[];
}): MixCartValidationResult {
  const { tier, profile, selectedFlavors } = params;

  if (!tier) {
    return {
      canSubmit: false,
      reason: 'Elige primero un formato de bolsa.',
      stockIssues: [],
    };
  }

  if (requiresProfileSelection(tier) && (!profile || profile === 'libre')) {
    return {
      canSubmit: false,
      reason: 'Selecciona Mix Dulce / Ácido o Mix Salado para continuar.',
      stockIssues: [],
    };
  }

  if (selectedFlavors.length === 0) {
    return {
      canSubmit: false,
      reason:
        tier.maxFlavors === 1
          ? 'Toca 1 sabor del catálogo para llenar tu bolsita de 80 g.'
          : `Toca entre 1 y ${tier.maxFlavors} sabores en el catálogo para armar tu bolsa.`,
      stockIssues: [],
    };
  }

  if (selectedFlavors.length > tier.maxFlavors) {
    return {
      canSubmit: false,
      reason: `Esta bolsa admite máximo ${tier.maxFlavors} sabores.`,
      stockIssues: [],
    };
  }

  // Doble verificación de unicidad y compatibilidad estricta
  const seen = new Set<string>();
  const effectiveProfile: MixProfile = requiresProfileSelection(tier)
    ? (profile ?? 'dulce-acido')
    : 'libre';

  for (const flavor of selectedFlavors) {
    if (seen.has(flavor.id)) {
      return {
        canSubmit: false,
        reason: 'Hay un sabor repetido en tu selección. Quítalo para continuar.',
        stockIssues: [],
      };
    }
    seen.add(flavor.id);

    if (!isCategoryCompatibleWithProfile(flavor.categoria, effectiveProfile)) {
      return {
        canSubmit: false,
        reason: 'Hay sabores incompatibles con el perfil de mezcla elegido.',
        stockIssues: [],
      };
    }
  }

  // Validación exacta de stock por cada sabor según reparto actual
  const stockIssues = findMixStockIssues(tier, selectedFlavors);
  if (stockIssues.length > 0) {
    const first = stockIssues[0];
    const canSplitMore = selectedFlavors.length < tier.maxFlavors;
    const hint = canSplitMore
      ? 'Agrega otro sabor para repartir el peso o quita este sabor.'
      : 'Quita este sabor o elige un formato más pequeño.';
    return {
      canSubmit: false,
      reason: `${first.nombre} tiene ${first.availableGrams} g disponibles y le corresponden ${first.requiredGrams} g. ${hint}`,
      stockIssues,
    };
  }

  return {
    canSubmit: true,
    reason: null,
    stockIssues: [],
  };
}

/**
 * Construye el payload `MixContextDTO` emitido en `mix:contextoActualizado`
 * para sincronizar el módulo `catalogo` sin acoplamiento directo.
 *
 * Nota sobre `gramsPerFlavor` emitido al catálogo:
 * - Mientras aún quede cupo libre en la bolsa (`selected.length < maxFlavors`),
 *   emitimos el piso mínimo de stock del tramo (`getMinPossibleGramsForTier`),
 *   para no bloquear prematuramente un sabor que sí cumple al dividir el peso
 *   con más sabores.
 * - Al completar el cupo (o en 80g), emitimos los gramos equitativos exactos.
 */
export function buildMixContextDTO(
  tier: BagTierDTO | null,
  profile: MixProfile | null,
  selectedFlavors: ProductDTO[]
): MixContextDTO {
  if (!tier) {
    return {
      tier: null,
      profile: null,
      selectedIds: [],
      gramsPerFlavor: 0,
    };
  }

  const effectiveProfile: MixProfile | null = requiresProfileSelection(tier)
    ? profile
    : 'libre';

  const gramsForCatalogFilter =
    selectedFlavors.length >= tier.maxFlavors
      ? calculateEquitableGramsPerFlavor(tier.grams, selectedFlavors.length)
      : getMinPossibleGramsForTier(tier);

  return {
    tier,
    profile: effectiveProfile,
    selectedIds: selectedFlavors.map((item) => item.id),
    gramsPerFlavor: gramsForCatalogFilter,
  };
}

/**
 * Genera un identificador único por ítem de bolsa (se conserva intacto en modo edición).
 */
export function generateMixUid(): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `mix-${Date.now()}-${randomPart}`;
}

/**
 * Construye el objeto final `MixItemDTO` listo para enviarse al carrito
 * mediante el evento `mix:agregadoAlCarrito`.
 */
export function buildMixItemDTO(params: {
  uid?: string | null;
  tier: BagTierDTO;
  profile: MixProfile;
  selectedFlavors: ProductDTO[];
}): MixItemDTO {
  const { uid, tier, profile, selectedFlavors } = params;
  const distribution = distributeGramsEquitably(tier.grams, selectedFlavors.length);

  const flavors: MixFlavorDTO[] = selectedFlavors.map((flavor, idx) => ({
    productId: flavor.id,
    nombre: flavor.nombre,
    grams: distribution[idx] ?? 0,
    imgCalcomania: flavor.imgCalcomania,
  }));

  return {
    uid: uid && uid.trim().length > 0 ? uid : generateMixUid(),
    tierId: tier.id,
    grams: tier.grams,
    priceClp: tier.priceClp,
    profile: requiresProfileSelection(tier) ? profile : 'libre',
    flavors,
  };
}

/**
 * Filtra una lista de sabores elegidos dejando únicamente los compatibles
 * con un nuevo perfil y recortando al nuevo cupo máximo si se bajó de tramo.
 */
export function reconcileFlavorsForChange(params: {
  selectedFlavors: ProductDTO[];
  targetTier: BagTierDTO;
  targetProfile: MixProfile | null;
}): {
  kept: ProductDTO[];
  removedIncompatibleCount: number;
  trimmedByLimitCount: number;
} {
  const { selectedFlavors, targetTier, targetProfile } = params;

  let filtered = [...selectedFlavors];
  let removedIncompatibleCount = 0;

  if (targetProfile && targetProfile !== 'libre') {
    const compatible = filtered.filter((item) =>
      isCategoryCompatibleWithProfile(item.categoria, targetProfile)
    );
    removedIncompatibleCount = filtered.length - compatible.length;
    filtered = compatible;
  }

  let trimmedByLimitCount = 0;
  if (filtered.length > targetTier.maxFlavors) {
    trimmedByLimitCount = filtered.length - targetTier.maxFlavors;
    filtered = filtered.slice(0, targetTier.maxFlavors);
  }

  return {
    kept: filtered,
    removedIncompatibleCount,
    trimmedByLimitCount,
  };
}
