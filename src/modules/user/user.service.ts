import { BadRequestException, Injectable } from '@nestjs/common'
import { UserLoginArgs } from './dto/user.args'
import { User } from './entities/user'
import * as gameDb from 'game-db'
import crypto from 'crypto'
import config from '../../config'

@Injectable()
export class UserService {
  async login(args: UserLoginArgs): Promise<User> {
    console.log(args)
    let user
    try {
      const params = new URLSearchParams(args.initData)
      const parsed: Record<string, string> = {}
      params.forEach((value, key) => {
        parsed[key] = value
      })
      console.log(parsed)
      const hash = parsed.hash
      delete parsed.hash

      const dataCheckString = Object.keys(parsed)
        .sort()
        .map((key) => `${key}=${parsed[key]}`)
        .join('\n')

      const secret = crypto.createHash('sha256').update(config.botToken).digest()
      const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

      if (hmac !== hash) {
        throw new BadRequestException('Invalid initData hash')
      }
      const telegramUser = JSON.parse(parsed.user)
      user = await gameDb.Entities.User.findOne({ where: { idTelegram: telegramUser.id } })
    } catch (err) {
      console.log(err)
    }

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // if (!user) {
    //   user = gameDb.Entities.User.create({
    //     name: telegramUser.first_name,
    //     surname: telegramUser.last_name,
    //     username: telegramUser.username,
    //     idTelegram: telegramUser.id,
    //   })
    //   await user.save()
    // }

    return user
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
