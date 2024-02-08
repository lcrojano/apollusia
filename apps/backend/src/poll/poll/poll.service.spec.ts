import {Poll, PollEventDto} from '@apollusia/types';
import {NotFoundException} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {Test, TestingModule} from '@nestjs/testing';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Model, Types} from 'mongoose';

import {PollService} from './poll.service';
import {ParticipantStub, PollEventStub, PollStub} from '../../../test/stubs';
import {PollModule} from '../poll.module';

describe('PollService', () => {
  let mongoServer: MongoMemoryServer;
    let service: PollService;
    let pollModel: Model<Poll>;
    let pollEventModel: Model<PollEventDto>;

    beforeAll(async () => {
      mongoServer = await MongoMemoryServer.create();

        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(mongoServer.getUri()),
                PollModule,
            ],
        }).compile();

        pollModel = module.get('PollModel');
        pollEventModel = module.get('PollEventModel');
        service = module.get<PollService>(PollService);
    });

  afterAll(async () => {
    await mongoServer?.stop();
  });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should create poll', async () => {
        const poll = await service.postPoll(PollStub());
        const pollCounts = await pollModel.countDocuments().exec();
        expect(poll).toBeDefined();
        expect(pollCounts).toEqual(1);
    });

    it('should get poll', async () => {
        const poll = await service.getPoll(PollStub()._id);
        expect(poll).toBeDefined();
    });

    it('should get all polls', async () => {
        const polls = await service.getPolls(ParticipantStub().token, true);
        expect(polls).toBeDefined();
        expect(polls.length).toEqual(1);
    });

    it('should update poll', async () => {
        const modifiedPoll = PollStub();
        modifiedPoll.title = 'Party';

        const oldPoll = await pollModel.findOne({_id: PollStub()._id}).exec();
        await service.putPoll(modifiedPoll._id, modifiedPoll);
        const updatedPoll = await pollModel.findOne({_id: PollStub()._id}).exec();

        expect(oldPoll._id).toEqual(updatedPoll._id);
        expect(oldPoll.title).not.toEqual(updatedPoll.title);
        expect(updatedPoll.title).toEqual('Party');
    });

    it('should not update poll', async () => {
        const modifiedPoll = PollStub();
        modifiedPoll._id = new Types.ObjectId('9e9e9e9e9e9e9e9e9e9e9e9e');
        modifiedPoll.title = 'Meeting';

        const oldPoll = await pollModel.findOne({_id: PollStub()._id}).exec();
        await expect(service.putPoll(modifiedPoll._id, modifiedPoll)).rejects.toThrow(NotFoundException);
        const updatedPoll = await pollModel.findOne({_id: PollStub()._id}).exec();
        const pollCounts = await pollModel.countDocuments().exec();

        expect(oldPoll.title).toEqual(updatedPoll.title);
        expect(updatedPoll.title).not.toEqual('Meeting');
        expect(pollCounts).toEqual(1);
    });

    it('should clone poll', async () => {
        let pollCounts = await pollModel.countDocuments().exec();
        expect(pollCounts).toEqual(1);

        const clonedPoll = await service.clonePoll(PollStub()._id);
        pollCounts = await pollModel.countDocuments().exec();

        expect(clonedPoll).toBeDefined();
        expect(clonedPoll._id).not.toEqual(PollStub()._id);
        expect(pollCounts).toEqual(2);
    });

    it('should delete poll', async () => {
        let pollCounts = await pollModel.countDocuments().exec();
        expect(pollCounts).toEqual(2);

        await service.deletePoll(PollStub()._id);
        pollCounts = await pollModel.countDocuments().exec();

        expect(pollCounts).toEqual(1);
    });

    it('should not delete poll', async () => {
        let pollCounts = await pollModel.countDocuments().exec();
        expect(pollCounts).toEqual(1);

        await expect(service.deletePoll(PollStub()._id)).rejects.toThrow(NotFoundException);
        pollCounts = await pollModel.countDocuments().exec();

        expect(pollCounts).toEqual(1);
    });

    it('should add events to poll', async () => {
        const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
        let pollEventCount = await pollEventModel.countDocuments().exec();
        expect(pollEventCount).toEqual(0);
        const event = await service.postEvents(poll._id, [PollEventStub()] as any);

        pollEventCount = await pollEventModel.countDocuments().exec();
        expect(event[0].poll).toEqual(poll._id);
        expect(pollEventCount).toEqual(1);
    });

    it('should get events from poll', async () => {
        const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
        const events = await service.getEvents(poll._id);
        expect(events.length).toEqual(1);
    });

    it('should delete events from poll', async () => {
        const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
        const events = await service.postEvents(poll._id, []);
        expect(events.length).toEqual(0);
    });

    it('should not get participants from poll', async () => {
       const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
       const participants = await service.getParticipants(poll._id, ParticipantStub().token);
       expect(participants.length).toEqual(0);
    });

    it('should post participation', async () => {
      const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
      await service.postParticipation(poll._id, ParticipantStub());
      const participants = await service.getParticipants(poll._id, ParticipantStub().token);
      expect(participants.length).toEqual(1);
    });

    it('should not post participation', async () => {
      await expect(service.postParticipation(
        new Types.ObjectId('5f1f9b9b9b9b942b9b9b9b9b'),
        ParticipantStub())
      ).rejects.toThrow(NotFoundException);
    });

    it('should be admin', async () => {
      const poll = await pollModel.findOne({title: 'Party (clone)'}).exec();
      const isAdmin = await service.isAdmin(poll._id, ParticipantStub().token);
      expect(isAdmin).toEqual(true);
    });
});
