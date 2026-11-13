import { CreateRestaurantDto } from './dto/create-restaurant.dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto/update-restaurant.dto';
import { RestaurantStatus } from './dto/update-restaurant-status.dto/update-restaurant-status.dto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from './entities/restaurant.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  async findAll(): Promise<Restaurant[]> {
    return this.restaurantRepository.find();
  }

  async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id },
    });

    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    return restaurant;
  }

  async create(createRestaurantDto: CreateRestaurantDto): Promise<Restaurant> {
    const restaurant = this.restaurantRepository.create({
      ...createRestaurantDto,
      status: 'pending',
    });

    return this.restaurantRepository.save(restaurant);
  }

  async update(
    id: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);

    Object.assign(restaurant, updateRestaurantDto);

    return this.restaurantRepository.save(restaurant);
  }

  async remove(id: string): Promise<{ message: string }> {
    const restaurant = await this.findOne(id);

    await this.restaurantRepository.remove(restaurant);

    return {
      message: 'Xóa nhà hàng thành công',
    };
  }

  async updateStatus(
    id: string,
    status: RestaurantStatus,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);

    restaurant.status = status;

    return this.restaurantRepository.save(restaurant);
  }
}
