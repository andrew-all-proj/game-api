import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql'
import { UserService } from './user.service'
import { User, UserLogin } from './entities/user'
import { UserLoginArgs } from './dto/user.args'

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => UserLogin)
  UserLogin(@Args() args: UserLoginArgs): Promise<UserLogin> {
    return this.userService.login(args)
  }

  // @Mutation(() => User)
  // UserCreate(@Args('createUserInput') createUserInput: CreateUserInput) {
  //   return this.userService.create(createUserInput);
  // }

  // @Query(() => [User])
  // Users() {
  //   return this.userService.findAll();
  // }

  // @Query(() => User, { name: 'user' })
  // User(@Args('id', { type: () => Int }) id: number) {
  //   return this.userService.findOne(id);
  // }

  // @Mutation(() => User)
  // UserUpdate(@Args('updateUserInput') updateUserInput: UpdateUserInput) {
  //   return this.userService.update(updateUserInput.id, updateUserInput);
  // }

  // @Mutation(() => User)
  // UserRemove(@Args('id', { type: () => Int }) id: number) {
  //   return this.userService.remove(id);
  // }
}
