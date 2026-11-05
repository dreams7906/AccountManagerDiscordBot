import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import { verificationRoleProblem, applyVerifiedRole } from '../src/verification.js';
import { verificationPanel } from '../src/commands/verify.js';

const role = permissions => ({ id:'verified',guild:{id:'guild'},managed:false,permissions:new PermissionsBitField(permissions) });
test('public verification never assigns staff, managed or moderation roles',()=>{
  assert.equal(verificationRoleProblem(role([])),null);
  assert.match(verificationRoleProblem(role([]),['verified']),/member role/);
  for (const permission of [PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.BanMembers])
    assert.match(verificationRoleProblem(role([permission])),/member role/);
  assert.match(verificationRoleProblem({...role([]),managed:true}),/normal member role/);
});
test('role assignment is idempotent, respects hierarchy and restores a missing role',async()=>{
  let grants=0;
  const member={guild:{members:{fetchMe:async()=>({permissions:new PermissionsBitField([PermissionFlagsBits.ManageRoles]),roles:{highest:{comparePositionTo:()=>1}}})}},
    roles:{cache:new Set(),add:async r=>{grants++;member.roles.cache.add(r.id);}}};
  assert.equal(await applyVerifiedRole(member,role([])),true);
  assert.equal(await applyVerifiedRole(member,role([])),false);
  member.roles.cache.clear();
  assert.equal(await applyVerifiedRole(member,role([])),true);
  assert.equal(grants,2);
  member.guild.members.fetchMe=async()=>({permissions:new PermissionsBitField([PermissionFlagsBits.ManageRoles]),roles:{highest:{comparePositionTo:()=>-1}}});
  await assert.rejects(applyVerifiedRole(member,role([])),/above the verified role/);
});
test('panel uses the requested title and member-accessible verification button',()=>{
  const panel=verificationPanel();
  assert.equal(panel.embeds[0].toJSON().title,'✅ Verification required');
  assert.equal(panel.components[0].toJSON().components[0].label,'Verify now!');
  assert.equal(panel.components[0].toJSON().components[0].custom_id,'verify:check');
});
