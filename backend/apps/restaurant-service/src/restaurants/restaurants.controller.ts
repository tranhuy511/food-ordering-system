
import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto/update-restaurant.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto/update-restaurant-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator/roles.decorator';

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
  ) {}

  // Lấy danh sách nhà hàng - công khai
  @Get()
  findAll() {
    return this.restaurantsService.findAll();
  }

  // Lấy thông tin nhà hàng theo ID - công khai
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }

  // Tạo nhà hàng - yêu cầu đăng nhập
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createRestaurantDto: CreateRestaurantDto) {
    return this.restaurantsService.create(createRestaurantDto);
  }

  // Cập nhật nhà hàng - yêu cầu đăng nhập
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(
      id,
      updateRestaurantDto,
    );
  }

  // Xóa nhà hàng - chỉ Admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }

  // Duyệt hoặc ngừng hoạt động nhà hàng - chỉ Admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateRestaurantStatusDto,
  ) {
    return this.restaurantsService.updateStatus(
      id,
      updateStatusDto.status,
    );
  }
}
