// Contrato público del módulo catalogo (productos y filtros).
export type ProductType = 'gomita' | 'mani';
export type ProductCategory = 'dulce' | 'acido' | 'salado';

export interface ProductDTO {
  id: string;
  nombre: string;
  tipo: ProductType;
  categoria: ProductCategory;
  stockGramos: number;
  activo: boolean;
  imgCalcomania: string;
  imgProducto: string;
}

export interface CatalogFilterDTO {
  query: string;
  tipo: ProductType | 'todos';
  categoria: ProductCategory | 'todas';
}

export interface ICatalogoService {
  loadProducts(): Promise<ProductDTO[]>;
  filterProducts(items: ProductDTO[], filter: CatalogFilterDTO): ProductDTO[];
}
