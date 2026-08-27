import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { DirectoryService } from './directory.service';
import { ImportDirectoryDto } from './dto/import-directory.dto';

@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  /** Any signed-in user can read the roster — it backs the nominee picker on the nominate form. */
  @Get()
  async listAll() {
    const people = await this.directoryService.listAll();
    return people.map((person) => ({ email: person.email, name: person.name }));
  }

  @Roles(Role.Admin)
  @Post('import')
  importCsv(@Body() dto: ImportDirectoryDto) {
    return this.directoryService.importFromCsv(dto.csv);
  }
}
