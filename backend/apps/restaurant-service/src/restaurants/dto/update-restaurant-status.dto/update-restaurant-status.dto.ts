import {
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export type RestaurantStatus =
  | 'pending'
  | 'active'
  | 'inactive';

export class UpdateRestaurantStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'active', 'inactive'])
  status: RestaurantStatus;
}