export type RestaurantStatus = 'pending' | 'active' | 'inactive';

export class UpdateRestaurantStatusDto {
  status: RestaurantStatus;
}
