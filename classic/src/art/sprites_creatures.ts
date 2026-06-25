// Creature battle sprites (pixel art), facing right. Defenders are drawn flipped.
// Also used as map markers for monster stacks (scaled down). Portraits reuse the
// same sprite scaled to fit a frame.
import { PixelSprite } from "./pixelsprite";
import { CreatureId } from "../data/creatures";

// d=straw, w/W/b brown, f skin, z/Z steel, g/G/l/V/v greens, y/Y/e gold,
// r/R red, a/A grey, n/N stone, j/J orange, h white, k ink, u blue.

const peasant = new PixelSprite([
  ".....ddddd......",
  "....ddddddd.z...",
  ".....fffff..z...",
  ".....fffff.zzz..",
  "......www...z...",
  ".....wwwww..z...",
  "....wwwwwww.z...",
  "....wwwwwww.z...",
  "....wWWWWWw.z...",
  ".....wWWWw..z...",
  ".....wWWWw......",
  "......bbb.......",
  ".....bb.bb......",
  ".....bb.bb......",
  ".....k...k......",
]);

const archer = new PixelSprite([
  ".....GG.........",
  "....Gffg........",
  "....ffff..V.....",
  "....ffff.VVV....",
  "....gggg.V.V....",
  "...ggGggg.V.....",
  "..g.gGGgg.V.....",
  "..g.gGGgg.V.....",
  "..g.gGGgg.V.....",
  "...l.GGg.V.V....",
  "....GGGG.VVV....",
  "....bb.bb..V....",
  "....bb.bb.......",
  "....k...k.......",
]);

const pikeman = new PixelSprite([
  ".......z........",
  "......zzz.......",
  ".....zfffz......",
  ".....zfffz......",
  "....zzzzzz...z..",
  "...zZZZZZZz..z..",
  "..u.ZZZZZZ.z.z..",
  "..uu ZZZZZ.z.z..",
  "...u.ZZZZZ..z...",
  "....ZZZZZZ..z...",
  "....ZZZZZZ..z...",
  ".....ZZZZ...z...",
  "....bb..bb......",
  "....bb..bb......",
  "....k....k......",
]);

const swordsman = new PixelSprite([
  ".....zzzz.......",
  "....zhhhhz......",
  "....zfffz.......",
  "....zfffz...z...",
  "...zzzzzz..zz...",
  "..rzZZZZZz.zz...",
  "..rzZZZZZzZz....",
  "..rrZZZZZzz.....",
  "...zZZZZZz......",
  "...zZZZZZZz.....",
  "....ZZZZZZ......",
  "....ZZZZZZ......",
  "....bb..bb......",
  "....bb..bb......",
  "....k....k......",
]);

const cavalry = new PixelSprite([
  "..........zz........",
  ".........zhhz.......",
  ".........zffz.......",
  "........zzzzz.......",
  ".......rzZZZz.......",
  ".......rZZZZZ.......",
  "...wwwwwwwwwwww.....",
  "..wWWWWWWWWWWWWw....",
  ".wWWWWWWWWWWWWWWw...",
  ".wWWWWWWWWWWWWWWw...",
  "..W..WW....WW..W....",
  "..b..bb....bb..b....",
  "..b..bb....bb..b....",
  "..k..kk....kk..k....",
]);

const paladin = new PixelSprite([
  "......eyye.......",
  ".....eyyyye......",
  ".....zfffz.......",
  ".....zfffz...y...",
  "....yzzzzzy..y...",
  "...yzeeeeezy.y...",
  "...yzeeeeez.yy...",
  "..h.zeeeeez.y...",
  "..hh eeeeee.y...",
  "...h.eeeeee.y...",
  "....eeeeeee.y...",
  "....zeeeeez.....",
  "....bb..bb......",
  "....bb..bb......",
  "....k....k......",
]);

// ---- Sorceress / Rampart ----
const sprite = new PixelSprite([
  ".....c...c......",
  "......c.c.......",
  ".....offo.......",
  "....cVVVVc......",
  "...ccVVVVcc.....",
  "....cVVVVc......",
  ".....VVVV.......",
  "......VV........",
  "......k.k.......",
]);

const elfArcher = new PixelSprite([
  ".....GG.........",
  "....GffG........",
  "....ffff..o.....",
  "....ffff.ooo....",
  "....gggg.o.o....",
  "...vgGgg.o......",
  "..v.gGgg.o......",
  "..v.gGgg.o......",
  "...v.GGg.o.o....",
  "....GGGG.ooo....",
  "....bb.bb..o....",
  "....bb.bb.......",
  "....k...k.......",
]);

const druid = new PixelSprite([
  ".....GGG........",
  "....GfffG.......",
  "....ffff........",
  "....BBBB...o....",
  "...BBGBBB..B....",
  "...BBGBBB..B....",
  "...BBGBBB..B....",
  "...BBGBBB..o....",
  "...BBBBBB..B....",
  "....BBBB...B....",
  "....BBBB...B....",
  "....k..k........",
]);

const unicorn = new PixelSprite([
  "............e...",
  "...........zhz..",
  "..........zhhz..",
  ".........zhffz..",
  "........zhhhhz..",
  "...hhhhhhhhhhh..",
  "..hxhhhhhhhhhh..",
  ".hxhhhhhhhhhhh..",
  ".hxhhhhhhhhhhh..",
  "..h..hh...hh.h..",
  "..h..hh...hh.h..",
  "..k..kk...kk.k..",
]);

const treant = new PixelSprite([
  ".....VVV........",
  "....VVVVV.......",
  "...VVVVVVV......",
  "....VVVVV.......",
  ".....wkw........",
  "....wwkww.......",
  "...ww.k.ww......",
  "...w..w..w......",
  "...wwwwwww......",
  "...ww.w.ww......",
  "...w..w..w......",
  "...k.....k......",
]);

const phoenix = new PixelSprite([
  ".....j.....j....",
  "....jrj...jrj...",
  "...jrRrj.jrRrj..",
  "....jrRrjrRrj...",
  ".....jrRRRrj....",
  "...yyjrRRRrjyy..",
  "..yjjjrRRRrjjjy.",
  "...yyjrRRRrjyy..",
  ".....jrRRRrj....",
  "......jrrrj.....",
  ".......jjj......",
  ".......j.j......",
]);

// ---- Warlock / Dungeon ----
const troglodyte = new PixelSprite([
  "....aaa.........",
  "...akkka........",
  "...aaaaa........",
  "..aaaaaaa.......",
  "..A.aaaa.A......",
  "..A.aaaa.A......",
  "...aaaaaa.......",
  "...aa..aa.......",
  "...k....k.......",
]);

const harpy = new PixelSprite([
  "......ff........",
  ".....ffff.......",
  "..A..wwww..A....",
  ".AA.wWWWWw.AA...",
  ".A.wWWWWWWw.A...",
  "...wWWWWWWw.....",
  "....WWWWWW......",
  "....ww..ww......",
  "....j....j......",
  "....k....k......",
]);

const gazer = new PixelSprite([
  "....p.p.p.......",
  "...ppppppp......",
  "..pPPPPPPPp.....",
  ".pPPhhhPPPp.....",
  ".pPPhkhPPPp.....",
  ".pPPhhhPPPp.....",
  "..pPPPPPPPp.....",
  "...ppppppp......",
  "....p.p.p.......",
]);

const minotaur = new PixelSprite([
  "...z.....z......",
  "...zw...wz......",
  "...wwwkwww......",
  "...wwkkkww......",
  "....wwwww...z...",
  "...BwwwwwB.zz...",
  "..BBwwwwwBBz....",
  "..BBWWWWWBz.....",
  "...BWWWWWB......",
  "...BWWWWWB......",
  "...ww...ww......",
  "...k.....k......",
]);

const manticore = new PixelSprite([
  ".............R..",
  "....j.......RR..",
  "...jJj.....RRR..",
  "..jJffJ...RRR...",
  "..jJkkJjjjRR....",
  "..jJJJJjjjj.....",
  ".jjJJJJJJJj.....",
  ".jjJJJJJJj.j....",
  "..j..jj..j.jj...",
  "..k..kk..k......",
]);

const blackDragon = new PixelSprite([
  "................pp....",
  "...Z...........ZAAZ...",
  "..ZAZ.........ZAAAAZ..",
  "..ZAAZ.......ZAAffAZ..",
  "...ZAAZ.....ZAAAkAAZ..",
  "....ZAAZZZZZAAAAAAZ...",
  "..ZZZAAAAAAAAAAAAZ....",
  ".ZAAAAAAAAAAAAAAZ.....",
  "ZAAAAAAAAAAAAAAj......",
  ".ZAAAAAAAAAAAjj.......",
  "..ZAAAZ.ZAAAZ.........",
  "..ZAAZ...ZAAZ.........",
  "..jj.......jj.........",
  "..j.........j.........",
]);

// ---- Necropolis ----
const skeleton = new PixelSprite([
  ".....xxx........",
  "....xkkkx.......",
  "....xkxkx.......",
  ".....xxx........",
  "......x.....x...",
  "...x.xxx.x..x...",
  "...xx.x.xx..x...",
  "....x.x.x...x...",
  "....xxxxx.......",
  "....x.x.x.......",
  "....x...x.......",
  "....k...k.......",
]);

const zombie = new PixelSprite([
  ".....GgG........",
  "....GfffG.......",
  "....GkfkG.......",
  "....ffff........",
  "...gGGGGg..G....",
  "..g.GGGG.g.G....",
  "..g.GGGG...G....",
  "...GGGGGG..G....",
  "...GGGGGG.......",
  "....GG.GG.......",
  "....G...G.......",
  "....k...k.......",
]);

const ghost = new PixelSprite([
  ".....CCC........",
  "....CccccC......",
  "....cCkCkc......",
  "....ccccc.......",
  "...cccccccc.....",
  "...cCcccCcc.....",
  "...cccccccc.....",
  "...ccccccc......",
  "...c.ccc.c......",
  "....c.c.c.......",
  "...c..c..c......",
]);

const vampire = new PixelSprite([
  ".....RRR........",
  "....RfffR.......",
  "....fkfkf.......",
  "....ffff........",
  "...RkkkkkR......",
  "..RRkkkkkRR.....",
  ".R.RkkkkkR.R....",
  ".R.RkkkkkR.R....",
  "...RkkkkkR......",
  "...Rkk.kkR......",
  "....kk.kk.......",
  "....k...k.......",
]);

const lich = new PixelSprite([
  ".....xxx........",
  "....xkkkx.......",
  "....xkxkx.......",
  ".....xxx........",
  "....ppppp..y....",
  "...ppPpppp.y....",
  "...ppPpppp.y....",
  "...ppPpppp.e....",
  "...ppppppp.y....",
  "....ppppp..y....",
  "....ppppp..y....",
  "....k...k.......",
]);

const boneDragon = new PixelSprite([
  "................xx....",
  "...x...........xaax...",
  "..xax.........xaaaax..",
  "..xaax.......xaaffax..",
  "...xaax.....xaaakaax..",
  "....xaaxxxxxaaaaaaax..",
  "..xxxaaaaaaaaaaaaax...",
  ".xaaaaaaaaaaaaaaax....",
  "xaaaaaaaaaaaaaaax.....",
  ".xaaaaaaaaaaaxx.......",
  "..xaaax.xaaax.........",
  "..xaax...xaax.........",
  "..xx.......xx.........",
  "..x.........x.........",
]);

const goblin = new PixelSprite([
  "....V..V....",
  "....VVVV....",
  "...VGffGV...",
  "...G.kk.G...",
  "....GGGG....",
  "...GGGGGG.w.",
  "..G.GGGG.ww.",
  "..G.GGGG.w..",
  "...GGGGGG...",
  "....GG.GG...",
  "....b...b...",
  "...k.....k..",
]);

const wolf = new PixelSprite([
  "..............A...",
  "............AAAAA.",
  "...........AAAffA.",
  "AA........AAAAkkA.",
  "AAAAAAAAAAAAAAAAA.",
  ".AAAAAAAAAAAAAAA..",
  ".aAAAAAAAAAAAAa...",
  "..A..AA....AA.A...",
  "..A..A.....A..A...",
  "..k..k.....k..k...",
]);

const ogre = new PixelSprite([
  ".....SSSSS......",
  "....SSSSSSS..w..",
  "....SkSSkS..ww..",
  "....SSSSSS.www..",
  "...SSSSSSSSwwn..",
  "..SSSSSSSSSwnn..",
  ".S.SSSSSSSS.nn..",
  ".S.SSSSSSSS.n...",
  "..SSSSSSSSSS....",
  "..SSSSSSSSSS....",
  "...SSS..SSS.....",
  "...bbb..bbb.....",
  "...k.....k......",
]);

const troll = new PixelSprite([
  ".....GGGGG......",
  "....GGGGGGG.....",
  "....GkGGkG......",
  "....GGvvGG......",
  "...GGGGGGGG..nn.",
  "..GGGGGGGGG.nnn.",
  ".G.GGGGGGGG.nn..",
  ".G.GGGGGGGG.....",
  "..GGGGGGGGGG....",
  "..GGG..GGGG.....",
  "...bb..bbb......",
  "...k....k.......",
]);

const dragon = new PixelSprite([
  "................rr....",
  "...r...........rRRr...",
  "..rRr.........rRRRRr..",
  "..rRRr.......rRRffRr..",
  "...rRRr.....rRRRkRRr..",
  "....rRRrrrrrRRRRRRr...",
  "..rrrRRRRRRRRRRRRr....",
  ".rRRRRRRRRRRRRRRr.....",
  "rRRRRRRRRRRRRRRj......",
  ".rRRRRRRRRRRRjj.......",
  "..rRRRr.rRRRr.........",
  "..rRRr...rRRr.........",
  "..jj.......jj.........",
  "..j.........j.........",
]);

const SPRITES: Record<CreatureId, PixelSprite> = {
  peasant, archer, pikeman, swordsman, cavalry, paladin,
  sprite, elfArcher, druid, unicorn, treant, phoenix,
  troglodyte, harpy, gazer, minotaur, manticore, blackDragon,
  skeleton, zombie, ghost, vampire, lich, boneDragon,
  goblin, wolf, ogre, troll, dragon,
};

export function creatureSprite(id: CreatureId): PixelSprite {
  return SPRITES[id];
}
