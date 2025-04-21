import { BadRequestException, Injectable } from '@nestjs/common'
import { UserLoginArgs } from './dto/user.args'
import { UserLogin } from './entities/user'
import * as gameDb from 'game-db'
import { JwtService } from '@nestjs/jwt'
import { parse, isValid } from '@telegram-apps/init-data-node'
import config from '../../config'

@Injectable()
export class UserService {
  constructor(private jwtService: JwtService) {}

  async login(args: UserLoginArgs): Promise<UserLogin> {
    console.log(args) //TODO remove
    let user
    try {
      const valid = isValid(args.initData, config.botToken)

      if (!valid) {
        throw new BadRequestException('Invalid initData hash')
      }

      const tlgUser = parse(args.initData).user
      const tlgId = tlgUser?.id

      if (!tlgId) {
        throw new BadRequestException('User not found in initData')
      }

      user = await gameDb.Entities.User.findOne({ where: { idTelegram: tlgId.toString() } })
    } catch (err) {
      console.log('Login error:', err)
      throw new BadRequestException('User initData error')
    }

    if (!user) {
      throw new BadRequestException('User not found')
    }

    const payload = {
      sub: user.id,
    }

    const token = this.jwtService.sign(payload)

    return {
      token: token,
      id: user.id,
    }
  }

  // create(createUserInput: CreateUserInput) {
  //   return 'This action adds a new user'
  // }

  // findAll() {
  //   console.log('findAll')
  //   return [{ id: 1 }]
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} user`
  // }

  // update(id: number, updateUserInput: UpdateUserInput) {
  //   return `This action updates a #${id} user`
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} user`
  // }
}
