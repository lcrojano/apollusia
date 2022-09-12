import {Body, Controller, Delete, Get, NotFoundException, Param, Post, Put} from '@nestjs/common';

import {PollService} from './poll.service';
import {PollDto, PollEventDto, ParticipantDto} from '../../dto';
import {Poll, Participant} from '../../schema';

@Controller('poll')
export class PollController {
    constructor(private readonly pollService: PollService) {
    }

    @Get()
    async getPolls(): Promise<Poll[]> {
        return this.pollService.getPolls();
    }

    @Get(':id')
    async getPoll(@Param('id') id: string): Promise<Poll> {
        return this.pollService.getPoll(id);
    }

    @Post()
    async postPoll(@Body() pollDto: PollDto): Promise<Poll> {
        return this.pollService.postPoll(pollDto);
    }

    @Put(':id')
    async putPoll(@Param('id') id: string, @Body() pollDto: PollDto): Promise<Poll> {
        return this.pollService.putPoll(id, pollDto);
    }

    @Delete(':id')
    async deletePoll(@Param('id') id: string): Promise<Poll | undefined> {
        const existingPoll = await this.pollService.getPoll(id);
        if (!existingPoll) {
            throw new NotFoundException(id);
        }

        return this.pollService.deletePoll(id);
    }

    @Post(':id/events')
    async postEvents(@Param('id') id: string, @Body() pollEvents: PollEventDto[]): Promise<Poll> {
        const existingPoll = await this.pollService.getPoll(id);
        if (!existingPoll) {
            throw new NotFoundException(id);
        }

        return this.pollService.postEvents(id, existingPoll, pollEvents);
    }

    @Get(':id/participate')
    async getParticipants(@Param('id') id: string): Promise<Participant[]> {
        return this.pollService.getParticipants(id);
    }

    @Post(':id/participate')
    async postParticipation(@Param('id') id: string, @Body() participant: ParticipantDto): Promise<Participant> {
        return this.pollService.postParticipation(id, participant);
    }
}
