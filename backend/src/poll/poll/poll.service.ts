import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Document, Model, Types} from 'mongoose';

import {MailDto, ParticipantDto, PollDto, PollEventDto} from '../../dto';
import {ReadPollDto, readPollSelect, ReadStatsPollDto} from '../../dto/read-poll.dto';
import {MailService} from '../../mail/mail/mail.service';
import {Participant, Poll, PollEvent} from '../../schema';

@Injectable()
export class PollService {
    constructor(
        @InjectModel(Poll.name) private pollModel: Model<Poll>,
        @InjectModel(PollEvent.name) private pollEventModel: Model<PollEvent>,
        @InjectModel(Participant.name) private participantModel: Model<Participant>,
        private mailService: MailService,
    ) {
    }

    async getPolls(token: string): Promise<ReadStatsPollDto[]> {
        const adminPolls = await this.pollModel.find({adminToken: token}).select(readPollSelect).exec();
        const participants = await this.participantModel.find({token}, null, {populate: 'poll'}).exec();
        const participantPolls = participants.map(participant => participant.poll);
        let polls = [...adminPolls, ...participantPolls];
        const filteredPolls = polls.filter((poll: Poll, index) => polls.findIndex((p: any) => p._id.toString() === poll._id.toString()) === index);
        const readPolls = filteredPolls.map(async (poll: Poll): Promise<ReadStatsPollDto> => ({
            _id: poll._id,
            title: poll.title,
            description: poll.description,
            location: poll.location,
            settings: poll.settings,
            bookedEvents: poll.bookedEvents,
            events: await this.pollEventModel.count({poll: poll._id}).exec(),
            participants: await this.participantModel.count({poll: poll._id}).exec(),
        }));

        return Promise.all(readPolls);
    };

    async getPoll(id: string): Promise<ReadPollDto> {
        return this.pollModel.findById(id).select(readPollSelect).exec();
    }

    async postPoll(pollDto: PollDto): Promise<ReadPollDto> {
        const {adminToken, adminMail, ...rest} = await this.pollModel.create(pollDto);
        return rest;
    }

    async putPoll(id: string, pollDto: PollDto): Promise<ReadPollDto> {
        return this.pollModel.findByIdAndUpdate(id, pollDto, {new: true}).select(readPollSelect).exec();
    }

    async clonePoll(id: string): Promise<ReadPollDto> {
        const {_id, bookedEvents, title, ...rest} = await this.pollModel.findById(id).exec();
        const pollEvents = await this.pollEventModel.find({poll: new Types.ObjectId(id)}).exec();
        const clonedPoll = await this.postPoll({
            ...rest,
            title: `${title} (clone)`,
        });
        await this.pollEventModel.create(pollEvents.map(({start, end, note}) => ({
            poll: clonedPoll._id,
            start,
            end,
            note,
        })));
        return clonedPoll;
    }

    async deletePoll(id: string): Promise<ReadPollDto | undefined> {
        const poll = await this.pollModel.findByIdAndDelete(id).select(readPollSelect).exec();
        if (!poll) {
            return;
        }

        await this.pollEventModel.deleteMany({poll: new Types.ObjectId(id)}).exec();
        await this.participantModel.deleteMany({poll: new Types.ObjectId(id)}).exec();
        return poll;
    }

    async getEvents(id: string): Promise<PollEvent[]> {
        return await this.pollEventModel.find({poll: new Types.ObjectId(id)}).exec();
    }

    async postEvents(id: string, pollEvents: PollEventDto[]): Promise<PollEvent[]> {
        const oldEvents = await this.pollEventModel.find({poll: new Types.ObjectId(id)}).exec();
        const newEvents = pollEvents.filter(event => !oldEvents.some(oldEvent => oldEvent._id.toString() === event._id));
        await this.pollEventModel.create(newEvents.map(event => ({...event, poll: new Types.ObjectId(id)})));

        const updatedEvents = pollEvents.filter(event => {
            const oldEvent = oldEvents.find(e => e._id.toString() === event._id);
            if (!oldEvent) {
                return false;
            }
            return oldEvent.start !== event.start || oldEvent.end !== event.end;
        });
        if (updatedEvents.length > 0) {
            for (const event of updatedEvents) {
                await this.pollEventModel.findByIdAndUpdate(event._id, event).exec();
            }
        }

        const deletedEvents = oldEvents.filter(event => !pollEvents.some(e => e._id === event._id.toString()));
        await this.pollEventModel.deleteMany({_id: {$in: deletedEvents.map(event => event._id)}}).exec();
        await this.removeParticipations(id, updatedEvents);
        return await this.pollEventModel.find({poll: new Types.ObjectId(id)}).exec();
    }

    async getParticipants(id: string) {
        return this.participantModel.find({poll: id}).populate(['participation', 'indeterminateParticipation']).exec();
    }

    async postParticipation(id: string, dto: ParticipantDto): Promise<Participant> {
        const poll = await this.pollModel.findById(id).exec();
        if (!poll) {
            throw new NotFoundException(id);
        }
        const participant = await this.participantModel.create({
            ...dto,
            poll: id,
        });

        poll.adminMail && this.sendAdminInfo(poll, participant);
        participant.mail && this.mailService.sendMail(participant.name, participant.mail, 'Participated in Poll', 'participated', {
            poll: poll.toObject(),
            participant: participant.toObject(),
        }).then();
        return participant;
    }

    private async sendAdminInfo(poll: Poll & Document, participant: Participant & Document) {
        const events = await this.getEvents(poll._id.toString());
        const participation = Array(events.length).fill({});

        for (let i = 0; i < events.length; i++){
            const event = events[i];
            const yes = participant.participation.some(e => e._id.toString() === event._id.toString());
            const maybe = participant.indeterminateParticipation.some(e => e._id.toString() === event._id.toString());
            participation[i] = {
                class: yes ? 'p-yes' : maybe ? 'p-maybe' : 'p-no',
                icon: yes ? '✓' : maybe ? '?' : 'X',
            };
        }

        return this.mailService.sendMail('Poll Admin', poll.adminMail, 'Updates in Poll', 'participant', {
            poll: poll.toObject(),
            participant: participant.toObject(),
            events: events.map(({start, end}) => ({start, end})),
            participants: [{name: participant.name, participation}],
        });
    }

    async editParticipation(id: string, participantId: string, participant: ParticipantDto): Promise<Participant> {
        return this.participantModel.findByIdAndUpdate(participantId, participant, {new: true}).exec();
    }

    async deleteParticipation(id: string, participantId: string): Promise<Participant> {
        return this.participantModel.findByIdAndDelete(participantId).exec();
    }

    async bookEvents(id: string, events: string[]): Promise<ReadPollDto> {
        const poll = await this.pollModel.findById(id).exec();
        poll.bookedEvents = await this.pollEventModel.find({_id: {$in: events}}).exec();
        for await (const participant of this.participantModel.find({poll: id}).populate(['participation', 'indeterminateParticipation'])) {
            const participations = [...participant.participation, ...participant.indeterminateParticipation];
            const appointments = poll.bookedEvents.map(event => {
                let eventLine = this.renderEvent(event);
                if (participations.some(p => p._id.toString() === event._id.toString())) {
                    eventLine += ' *';
                }
                return eventLine;
            });
            this.mailService.sendMail(participant.name, participant.mail, 'Poll booked', 'book', {
                appointments,
                poll: poll.toObject(),
                participant: participant.toObject(),
            }).then();
        }
        return this.pollModel.findByIdAndUpdate(id, poll, {new: true}).select(readPollSelect).exec();
    }

    private renderEvent(event: PollEvent) {
        return `${new Date(event.start).toLocaleString()} - ${new Date(event.end).toLocaleString()}`;
    }

    private async removeParticipations(id: string, events: PollEventDto[]) {
        const changedParticipants = await this.participantModel.find({
            poll: id,
            participation: {$in: events.map(event => event._id)},
        }).exec();
        const indeterminateParticipants = await this.participantModel.find({
            poll: id,
            indeterminateParticipation: {$in: events.map(event => event._id)},
        });

        changedParticipants.forEach(participant => {
            participant.participation = participant.participation.filter((event: any) =>
                !events.some(e => e._id.toString() === event._id.toString()));
            this.participantModel.findByIdAndUpdate(participant._id, participant).exec();
        });

        indeterminateParticipants.forEach(participant => {
            participant.indeterminateParticipation = participant.indeterminateParticipation.filter((event: any) =>
                !events.some(e => e._id.toString() === event._id.toString()));
            this.participantModel.findByIdAndUpdate(participant._id, participant).exec();
        });
    }

    async setMail(mailDto: MailDto) {
        const participants = await this.participantModel.find({token: mailDto.token}).exec();
        participants.forEach(participant => {
            participant.mail = mailDto.mail;
            participant.token = mailDto.token;
        });
        await this.participantModel.updateMany({token: mailDto.token}, {
            mail: mailDto.mail,
            token: mailDto.token,
        }).exec();
    }

    async isAdmin(id: string, token: string) {
        return this.pollModel.findById(id).exec().then(poll => poll.adminToken === token);
    }
}
