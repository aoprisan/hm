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
  goblin, wolf, ogre, troll, dragon,
};

export function creatureSprite(id: CreatureId): PixelSprite {
  return SPRITES[id];
}
