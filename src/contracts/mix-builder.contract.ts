// Contrato público de mix-builder (formatos, perfil y bolsa armada).
export type BagSizeId = '80g' | '500g' | '1kg' | '2kg' | '3kg';
export type MixProfile = 'dulce-acido' | 'salado' | 'libre';
export interface MixFlavorDTO { productId: string; nombre: string; grams: number; imgCalcomania: string; }

export interface BagTierDTO {
  id: BagSizeId; label: string; grams: number; priceClp: number;
  maxFlavors: number; bagStyle: 'doypack' | 'kraft';
}
export interface MixContextDTO {
  tier: BagTierDTO | null; profile: MixProfile | null;
  selectedIds: string[]; gramsPerFlavor: number;
}
export interface MixItemDTO {
  uid: string; tierId: BagSizeId; grams: number; priceClp: number;
  profile: MixProfile; flavors: MixFlavorDTO[];
}
