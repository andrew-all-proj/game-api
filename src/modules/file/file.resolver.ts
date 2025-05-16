import { Resolver, Query, Mutation, Args, Info } from '@nestjs/graphql'
import { FileService } from './file.service'
import { File, FilesList } from './entities/file'
import { FileArgs, FileCreateArgs, FileRemoveArgs, FilesListArgs, FileUpdateArgs } from './dto/file.args'
import { UseGuards } from '@nestjs/common'
import { GqlAuthGuard, RolesGuard, Roles } from '../../functions/auth'
import * as gameDb from 'game-db'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { GraphQLResolveInfo } from 'graphql'

@Resolver(() => File)
export class FileResolver {
  constructor(private readonly fileService: FileService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => FilesList)
  Files(@Args() args: FilesListArgs, @Info() info: GraphQLResolveInfo): Promise<FilesList> {
    return this.fileService.findAll(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(
    gameDb.datatypes.UserRoleEnum.SUPER_ADMIN,
    gameDb.datatypes.UserRoleEnum.ADMIN,
    gameDb.datatypes.UserRoleEnum.USER,
  )
  @Query(() => File)
  File(@Args() args: FileArgs, @Info() info: GraphQLResolveInfo): Promise<File> {
    return this.fileService.findOne(args, info)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN)
  @Mutation(() => File)
  FileCreate(@Args() args: FileCreateArgs): Promise<File> {
    return this.fileService.create(args)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN)
  @Mutation(() => File)
  FileUpdate(@Args() args: FileUpdateArgs): Promise<File> {
    return this.fileService.update(args)
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN)
  @Mutation(() => CommonResponse)
  FileRemove(@Args() args: FileRemoveArgs): Promise<CommonResponse> {
    return this.fileService.remove(args)
  }
}
