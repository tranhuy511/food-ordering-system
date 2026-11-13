
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unitPrice: number;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}
