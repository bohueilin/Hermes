// Exact display helpers: A30 threshold display, truncation that never rounds up, and BigInt-only unit conversion.
import test from 'node:test';import assert from 'node:assert/strict';
import {exactValue,numberText,secondsText,minutesText,hoursText,overdueText,kwhText,gbText,kwText,percentText,rationalText,signedText,groupDigits,componentKind} from '../src/ui/depot-lab-format.js';

test('A30: a positive overdue under one minute prints "< 1 min", never "0 min"; exact seconds stay available',()=>{
 for(const s of [1,6,59])assert.equal(overdueText(s),'< 1 min');
 assert.equal(overdueText(0),'0 min');
 assert.equal(secondsText(1),'1 s');assert.equal(secondsText(6),'6 s');
 assert.equal(secondsText(3600),'3,600 s');assert.equal(secondsText(3606),'3,606 s');
 for(const tick of [1199,1200,1201])assert.equal(secondsText(tick),`${groupDigits(String(tick))} s`);
});

test('minute and hour text truncates, so a shown value never reaches a whole-minute threshold it has not reached',()=>{
 assert.equal(minutesText(60),'1 min');assert.equal(minutesText(119),'1 min');assert.equal(minutesText(3599),'59 min');assert.equal(minutesText(3600),'60 min');
 assert.equal(minutesText('2100/1'),'35 min');assert.equal(minutesText('42900/1'),'715 min');
 assert.equal(minutesText('119/2'),'< 1 min');assert.equal(minutesText('121/2'),'1 min');
 assert.equal(hoursText(3599),'59 min');assert.equal(hoursText(3600),'1 h');assert.equal(hoursText(3606),'1 h');assert.equal(hoursText(42900),'11 h 55 min');
 assert.equal(hoursText(30),'< 1 min');assert.equal(minutesText(-61),'-1 min');
 for(let s=0;s<=7300;s+=1){const m=Number(minutesText(s).split(' ')[0].replace(/,/g,''));if(s>=60)assert.ok(m*60<=s&&s<(m+1)*60,String(s));}
});

test('mJ to kWh is exact BigInt division by 3,600,000,000 with truncation marked',()=>{
 assert.equal(kwhText(129600000000),'36 kWh');
 assert.equal(kwhText(2160000000),'0.6 kWh');
 assert.equal(kwhText(0),'0 kWh');
 assert.equal(kwhText(1),'< 0.001 kWh');
 assert.equal(kwhText(1000000000),'0.277… kWh');
 assert.equal(kwhText(3599999999),'0.999… kWh');
 assert.equal(kwhText(216000000000n*10n**20n),'6,000,000,000,000,000,000,000 kWh');
 assert.equal(kwhText('3600000001'),'1.000… kWh');
 assert.equal(kwhText(1000000000,9),'0.277777777… kWh');
});

test('bytes to GB is exact decimal division by 1,000,000,000',()=>{
 assert.equal(gbText(2000000000),'2 GB');assert.equal(gbText(500000000),'0.5 GB');
 assert.equal(gbText(2000000001),'2.000… GB');assert.equal(gbText(2000000001,9),'2.000000001 GB');
 assert.equal(gbText(1),'< 0.001 GB');assert.equal(gbText(0),'0 GB');
 assert.equal(gbText(50000000000),'50 GB');
});

test('rational strings format without float division; signed changes keep their sign',()=>{
 assert.equal(rationalText('1/3'),'0.333…');assert.equal(rationalText('7/2'),'3.5');assert.equal(rationalText('0/1'),'0');
 assert.equal(rationalText('2/3',0),'< 1');assert.equal(rationalText('5/3',0),'1…');
 assert.equal(numberText('-1/3'),'-0.333…');assert.equal(numberText('-1/3000000'),'> -0.001');
 assert.equal(kwText('300000/1'),'300 kW');assert.equal(kwText('100001/2'),'50.000… kW');
 assert.equal(percentText('17/60'),'28.3…%');assert.throws(()=>percentText('1020/3600'),TypeError);assert.equal(percentText('9999/10000'),'99.9…%');assert.equal(percentText('1/1'),'100%');assert.equal(percentText('1/100000'),'< 0.1%');
 assert.equal(signedText(480),'+480 s');assert.equal(signedText(-4200),'-4,200 s');assert.equal(signedText(0),'0 s');
 assert.equal(signedText('-3600/1',minutesText),'-60 min');assert.equal(signedText('40800/1',hoursText),'+11 h 20 min');
 const big='123456789012345678901234567891/7';assert.equal(rationalText(big),'17,636,684,144,620,811,271,604,938,270.142…');
});

test('only exact representations are accepted',()=>{
 for(const bad of [0.5,Number.NaN,2**60,'6/8','1.5','abc',null,undefined,{}])assert.throws(()=>exactValue(bad),TypeError);
 assert.deepEqual(exactValue('-2/4'.replace('2/4','1/2')),{n:-1n,d:2n});
});

test('one unit map per vector component serves the page and every summary (ARITH-03)',()=>{
 assert.deepEqual(['on_time_count','overdue_seconds','observed_visit_seconds','unreleased_count','remaining_reference_seconds:inspection','remaining_required_kWh','remaining_required_bytes'].map(id=>componentKind(id)[1]),['visits','s','s','visits','s','mJ','bytes']);
 assert.equal(componentKind('remaining_required_kWh')[0](129600000000),'36 kWh');assert.equal(componentKind('remaining_required_bytes')[0](2000000000),'2 GB');assert.equal(componentKind('overdue_seconds')[0](6),'6 s');
});
