// Curated field guide of birds you can realistically spot from a car window.
// Used to enrich live iNaturalist results (roadside tips, kid facts) and as a
// complete offline fallback when there is no signal.
//
// regions: pacific | southwest | mountain | plains | southeast | northeast | boreal | world
// rarity:  1 = common, 3 = uncommon, 5 = rare (also the points awarded)
// size:    sparrow | robin | pigeon | crow | goose | eagle
// group:   raptor | songbird | water | ground | corvid
// colors:  [body, wing, head, belly, beak] for the illustrated fallback sketch

const NA = ["pacific", "southwest", "mountain", "plains", "southeast", "northeast", "boreal"];
const NA_ALL = [...NA, "world"];

export const BIRDS = [
  {
    id: "red-tailed-hawk", name: "Red-tailed Hawk", sci: "Buteo jamaicensis", wiki: "Red-tailed_hawk",
    regions: NA, rarity: 1, size: "crow", group: "raptor", carSpot: true,
    lookFor: "Perched on light poles, fence posts and highway signs, watching the grassy shoulder for mice.",
    kidFact: "That fierce scream you hear for eagles in movies? It is usually a Red-tailed Hawk!",
    about: "The most common large hawk in North America and the classic highway hawk. Look for a pale chest with a dark 'belly band' and, on adults, a brick-red tail that glows when it banks in the sun.",
    colors: ["#8a5a3b", "#6b4430", "#7a4f35", "#f1e3cf", "#3b3b3b"],
  },
  {
    id: "american-kestrel", name: "American Kestrel", sci: "Falco sparverius", wiki: "American_kestrel",
    regions: NA, rarity: 3, size: "robin", group: "raptor", carSpot: true,
    lookFor: "Small falcon on power lines over open fields. It often bobs its tail or hovers in place like a tiny helicopter.",
    kidFact: "America's smallest falcon weighs about as much as a stick of butter.",
    about: "A colorful falcon with rusty back, blue-gray wings on males, and two black 'mustache' stripes on its face. Kestrels hunt grasshoppers and mice and can see ultraviolet light, which helps them track rodent trails.",
    colors: ["#c8683a", "#6f8fb3", "#8fa8c4", "#f3dcc0", "#2f3a45"],
  },
  {
    id: "turkey-vulture", name: "Turkey Vulture", sci: "Cathartes aura", wiki: "Turkey_vulture",
    regions: NA, rarity: 1, size: "eagle", group: "raptor", carSpot: true,
    lookFor: "Big dark bird soaring in a shallow 'V', wobbling side to side without flapping. Often in groups over the highway.",
    kidFact: "Turkey Vultures can smell food from more than a mile away, which is rare for birds.",
    about: "Nature's cleanup crew. Turkey Vultures ride warm air currents for hours and find carrion by smell. Adults have a bare red head. From below, the two-toned wings (dark front, silvery back) are the giveaway.",
    colors: ["#2d2622", "#3a302a", "#c8433a", "#2d2622", "#e9dccb"],
  },
  {
    id: "black-vulture", name: "Black Vulture", sci: "Coragyps atratus", wiki: "Black_vulture",
    regions: ["southeast", "plains", "northeast"], rarity: 3, size: "goose", group: "raptor", carSpot: true,
    lookFor: "Soaring with flat wings and white 'stars' at the wingtips, flapping more often than Turkey Vultures.",
    kidFact: "Black Vultures have no voice box. They can only hiss and grunt!",
    about: "Stockier and shorter-tailed than the Turkey Vulture, with a bare gray head. They follow Turkey Vultures to food because their own sense of smell is weaker, then muscle in as a group.",
    colors: ["#1f1f22", "#26262b", "#6e6e72", "#1f1f22", "#cfcfcf"],
  },
  {
    id: "bald-eagle", name: "Bald Eagle", sci: "Haliaeetus leucocephalus", wiki: "Bald_eagle",
    regions: NA, rarity: 5, size: "eagle", group: "raptor", carSpot: true,
    lookFor: "Near rivers, lakes and reservoirs. Huge dark body with a bright white head and tail, flying on flat, plank-like wings.",
    kidFact: "The biggest Bald Eagle nest ever found weighed about as much as a car!",
    about: "Once endangered by DDT, the national bird of the USA has made a remarkable comeback. Young eagles are mottled brown and take about five years to earn their white head.",
    colors: ["#3b2a1e", "#2f2118", "#ffffff", "#3b2a1e", "#f2c230"],
  },
  {
    id: "osprey", name: "Osprey", sci: "Pandion haliaetus", wiki: "Osprey",
    regions: NA_ALL, rarity: 3, size: "eagle", group: "raptor", carSpot: true,
    lookFor: "Big stick nests on top of cell towers, channel markers and power poles near water.",
    kidFact: "Ospreys turn fish head-first when they carry them, like a torpedo, to cut through the wind.",
    about: "The fish hawk lives on every continent except Antarctica. It is white below and brown above with a dark eye stripe, and it dives feet-first into water to catch fish.",
    colors: ["#4a3a2e", "#3d2f25", "#f5f2ec", "#fbfaf7", "#222222"],
  },
  {
    id: "peregrine-falcon", name: "Peregrine Falcon", sci: "Falco peregrinus", wiki: "Peregrine_falcon",
    regions: NA_ALL, rarity: 5, size: "crow", group: "raptor", carSpot: false,
    lookFor: "Bridges, cliffs and city skyscrapers. A sleek falcon with a dark 'helmet' and pointed wings.",
    kidFact: "In a dive, a Peregrine can top 200 mph. It is the fastest animal on Earth.",
    about: "A global traveler and one of conservation's great success stories. Peregrines hunt other birds in mid-air, and many now nest on bridges and tall buildings.",
    colors: ["#5b6b7a", "#44525f", "#26303a", "#efe8dc", "#f2c230"],
  },
  {
    id: "red-winged-blackbird", name: "Red-winged Blackbird", sci: "Agelaius phoeniceus", wiki: "Red-winged_blackbird",
    regions: NA, rarity: 1, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Clinging to cattails in wet roadside ditches, flashing red-and-yellow shoulder patches.",
    kidFact: "Males puff up their red shoulder patches like superhero badges to claim their turf.",
    about: "One of the most abundant birds in North America. Males are glossy black with red epaulets and sing a gurgling 'conk-la-ree!'. Females are streaky brown and are often mistaken for big sparrows.",
    colors: ["#141414", "#e0312b", "#141414", "#141414", "#2a2a2a"],
  },
  {
    id: "american-crow", name: "American Crow", sci: "Corvus brachyrhynchos", wiki: "American_crow",
    regions: ["pacific", "mountain", "plains", "southeast", "northeast", "boreal"], rarity: 1, size: "crow", group: "corvid", carSpot: true,
    lookFor: "Walking along the shoulder, in fields, or flying in loose flocks. All black with a square tail.",
    kidFact: "Crows can recognize human faces and remember them for years.",
    about: "Among the smartest animals on the planet, crows use tools, solve puzzles and hold 'funerals' for their dead. Their tail is squared off, which separates them from ravens.",
    colors: ["#121417", "#1b1e23", "#121417", "#121417", "#1a1a1a"],
  },
  {
    id: "common-raven", name: "Common Raven", sci: "Corvus corax", wiki: "Common_raven",
    regions: ["pacific", "southwest", "mountain", "boreal", "world"], rarity: 1, size: "goose", group: "corvid", carSpot: true,
    lookFor: "Deserts and mountains. Larger than a crow with a wedge-shaped tail and a deep, croaking voice.",
    kidFact: "Ravens do barrel rolls and slide down snowy roofs just for fun.",
    about: "The largest songbird in the world. Ravens soar like hawks, pair for life and can mimic sounds. The diamond-shaped tail in flight is the quickest way to tell them from crows.",
    colors: ["#0e0f13", "#17181d", "#0e0f13", "#0e0f13", "#1a1a1a"],
  },
  {
    id: "european-starling", name: "European Starling", sci: "Sturnus vulgaris", wiki: "Common_starling",
    regions: NA_ALL, rarity: 1, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Big swirling flocks over fields and on wires. Chunky, short-tailed, and speckled with glossy purple-green.",
    kidFact: "Huge starling flocks swirl together in shapes called murmurations.",
    about: "About 100 starlings were released in New York's Central Park in 1890. Today there are tens of millions in North America. They are expert mimics and can copy car alarms.",
    colors: ["#2b2f3a", "#3a3f4d", "#2c3a36", "#2b2f3a", "#e6c34a"],
  },
  {
    id: "rock-pigeon", name: "Rock Pigeon", sci: "Columba livia", wiki: "Rock_dove",
    regions: NA_ALL, rarity: 1, size: "pigeon", group: "ground", carSpot: true,
    lookFor: "Under overpasses, on bridges, at gas stations and truck stops.",
    kidFact: "Pigeons carried messages in wars and can find their way home from hundreds of miles away.",
    about: "Domesticated thousands of years ago, pigeons now live in nearly every city on Earth. Wild-type birds are gray with two black wing bars and an iridescent neck.",
    colors: ["#8a93a3", "#7a8394", "#5b6f78", "#a3abb8", "#2b2b2b"],
  },
  {
    id: "mourning-dove", name: "Mourning Dove", sci: "Zenaida macroura", wiki: "Mourning_dove",
    regions: NA, rarity: 1, size: "pigeon", group: "ground", carSpot: true,
    lookFor: "Sitting in pairs on power lines, slim and sandy-brown with a long pointed tail.",
    kidFact: "Their wings make a whistling sound when they take off.",
    about: "One of the most widespread birds in North America. Named for its soft, sad-sounding 'coo-OO-oo-oo'. Doves drink by sucking water up like a straw, which most birds cannot do.",
    colors: ["#b99e85", "#a38a72", "#c2a88f", "#dcc8b3", "#2b2b2b"],
  },
  {
    id: "american-robin", name: "American Robin", sci: "Turdus migratorius", wiki: "American_robin",
    regions: NA, rarity: 1, size: "robin", group: "songbird", carSpot: false,
    lookFor: "Hopping on lawns at rest stops and parks, then stopping to cock its head.",
    kidFact: "In fall, robins gobble so many fermented berries they sometimes get a little wobbly.",
    about: "A big thrush with a warm orange breast. Robins are often the first birds singing at dawn and are a classic sign of spring in the north.",
    colors: ["#5a5048", "#4d443d", "#2f2a27", "#e0772f", "#e5b93a"],
  },
  {
    id: "eastern-bluebird", name: "Eastern Bluebird", sci: "Sialia sialis", wiki: "Eastern_bluebird",
    regions: ["southeast", "northeast", "plains"], rarity: 3, size: "sparrow", group: "songbird", carSpot: true,
    lookFor: "Fence lines and wires along pastures and golf courses, often near nest boxes.",
    kidFact: "Bluebirds are not actually blue! Their feathers scatter light to look blue.",
    about: "Bright royal blue above with a rusty-orange throat and chest. People put up bluebird boxes along back roads, and it helped bring the species back from decline.",
    colors: ["#3a6fd1", "#2d5bb8", "#3a6fd1", "#d9824a", "#2b2b2b"],
  },
  {
    id: "western-bluebird", name: "Western Bluebird", sci: "Sialia mexicana", wiki: "Western_bluebird",
    regions: ["pacific", "southwest", "mountain"], rarity: 3, size: "sparrow", group: "songbird", carSpot: true,
    lookFor: "Open pine woods and orchards, perched low on fences before dropping down after insects.",
    kidFact: "Western Bluebirds sometimes have helpers: older siblings that help feed the new babies.",
    about: "Males have a deep blue head and throat with a rusty chest. They follow wildfires and forest thinning, where open ground makes insect hunting easy.",
    colors: ["#2c55b8", "#2748a0", "#2c55b8", "#c46b39", "#2b2b2b"],
  },
  {
    id: "northern-cardinal", name: "Northern Cardinal", sci: "Cardinalis cardinalis", wiki: "Northern_cardinal",
    regions: ["southeast", "northeast", "plains", "southwest"], rarity: 1, size: "robin", group: "songbird", carSpot: false,
    lookFor: "Thickets and shrubby edges at rest stops. Brilliant red with a pointed crest.",
    kidFact: "Cardinals are the state bird of seven US states, more than any other bird.",
    about: "Males are brilliant red all over; females are warm tan with red highlights. Both sing, and both have a black mask and a thick orange bill for cracking seeds.",
    colors: ["#d4202c", "#b81c26", "#d4202c", "#e0353f", "#f07a2b"],
  },
  {
    id: "blue-jay", name: "Blue Jay", sci: "Cyanocitta cristata", wiki: "Blue_jay",
    regions: ["southeast", "northeast", "plains"], rarity: 1, size: "robin", group: "corvid", carSpot: false,
    lookFor: "Flying across the road between oak woods, flashing blue and white. Listen for a loud 'jay! jay!'.",
    kidFact: "Blue Jays imitate hawk screams, maybe to scare other birds away from food.",
    about: "Clever, noisy and gorgeous. Blue Jays bury thousands of acorns each fall, and the ones they forget help plant new oak forests.",
    colors: ["#4a8ad9", "#2f6fc4", "#4a8ad9", "#eef1f5", "#222222"],
  },
  {
    id: "stellers-jay", name: "Steller's Jay", sci: "Cyanocitta stelleri", wiki: "Steller's_jay",
    regions: ["pacific", "mountain"], rarity: 3, size: "robin", group: "corvid", carSpot: false,
    lookFor: "Mountain campgrounds and pine forest pull-offs. Dark charcoal head with a tall crest and deep blue body.",
    kidFact: "Steller's Jays will boldly steal snacks from picnic tables.",
    about: "The jay of western evergreen forests. Named for the naturalist Georg Steller, who first recorded it in Alaska in 1741.",
    colors: ["#1f4f9c", "#1a4488", "#1a1f2a", "#2856a8", "#1a1a1a"],
  },
  {
    id: "california-scrub-jay", name: "California Scrub-Jay", sci: "Aphelocoma californica", wiki: "California_scrub_jay",
    regions: ["pacific"], rarity: 1, size: "robin", group: "corvid", carSpot: false,
    lookFor: "Suburbs, oak hills and rest-stop trees along the West Coast. Blue and gray with no crest.",
    kidFact: "Scrub-jays hide food, then move it again if they notice another bird watching.",
    about: "Bold and loud, this jay has a blue 'necklace' on a pale chest. Researchers study scrub-jays because they seem to plan for the future.",
    colors: ["#3f73c7", "#3566b5", "#3f73c7", "#d8d6d0", "#222222"],
  },
  {
    id: "black-billed-magpie", name: "Black-billed Magpie", sci: "Pica hudsonia", wiki: "Black-billed_magpie",
    regions: ["mountain", "plains", "boreal"], rarity: 1, size: "crow", group: "corvid", carSpot: true,
    lookFor: "Ranch land and roadsides in the interior West. Bold black-and-white with a very long, glossy tail.",
    kidFact: "Magpies build dome-shaped nests with a roof and side doors.",
    about: "A flashy, noisy member of the crow family. The long tail shines green and blue in sunlight. Magpies are often seen checking roadkill along ranch roads.",
    colors: ["#15181f", "#f4f4f4", "#15181f", "#f4f4f4", "#1a1a1a"],
  },
  {
    id: "western-meadowlark", name: "Western Meadowlark", sci: "Sturnella neglecta", wiki: "Western_meadowlark",
    regions: ["plains", "mountain", "southwest", "pacific"], rarity: 1, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Singing from the tops of fence posts in grassland. Bright yellow chest with a black 'V' necklace.",
    kidFact: "The Western Meadowlark is the state bird of six states!",
    about: "Its flute-like song is the sound of the open West. From behind, it is streaky brown and hard to see in grass, so watch for flashes of white outer tail feathers when it flies.",
    colors: ["#9c7a4d", "#8a6b43", "#9c7a4d", "#f5cd2b", "#c9c2b0"],
  },
  {
    id: "eastern-meadowlark", name: "Eastern Meadowlark", sci: "Sturnella magna", wiki: "Eastern_meadowlark",
    regions: ["southeast", "northeast", "plains"], rarity: 3, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Hay fields and pastures, perched on fence posts or wires.",
    kidFact: "Meadowlarks are not larks at all. They are related to blackbirds!",
    about: "Nearly identical to the Western Meadowlark but with a whistled, slurred song. Hayfield mowing during nesting season has made them less common.",
    colors: ["#9a7447", "#86653d", "#9a7447", "#f3c62a", "#c9c2b0"],
  },
  {
    id: "killdeer", name: "Killdeer", sci: "Charadrius vociferus", wiki: "Killdeer",
    regions: NA, rarity: 1, size: "robin", group: "water", carSpot: true,
    lookFor: "Gravel shoulders, parking lots and fields. Two black bands across a white chest.",
    kidFact: "Killdeer pretend to have a broken wing to lure predators away from their eggs.",
    about: "A shorebird that does not need a shore. Killdeer nest right on gravel, even in parking lots, and shout their name: 'kill-DEER!'.",
    colors: ["#a07a55", "#8c6a4a", "#a07a55", "#fafafa", "#1a1a1a"],
  },
  {
    id: "great-blue-heron", name: "Great Blue Heron", sci: "Ardea herodias", wiki: "Great_blue_heron",
    regions: NA, rarity: 1, size: "eagle", group: "water", carSpot: true,
    lookFor: "Standing motionless in ponds, ditches and river shallows. Flies slowly with its neck tucked in an 'S'.",
    kidFact: "A Great Blue Heron can stand four feet tall, about as tall as a 7-year-old!",
    about: "North America's largest heron. It stalks fish, frogs and even gophers, then strikes with lightning speed. Its huge slow wingbeats look almost prehistoric.",
    colors: ["#7c8ea3", "#6a7d93", "#e7e9ec", "#8a9bb0", "#d9a54a"],
  },
  {
    id: "great-egret", name: "Great Egret", sci: "Ardea alba", wiki: "Great_egret",
    regions: ["southeast", "pacific", "southwest", "northeast", "plains", "world"], rarity: 1, size: "eagle", group: "water", carSpot: true,
    lookFor: "Tall, all-white bird with a yellow bill wading in marshes and flooded fields.",
    kidFact: "Its beautiful feathers were once so popular on hats that the bird nearly vanished.",
    about: "The symbol of the National Audubon Society, which formed partly to stop the plume trade. Today egrets are common again in wetlands around the world.",
    colors: ["#fbfbf8", "#f2f2ee", "#fbfbf8", "#ffffff", "#f2c230"],
  },
  {
    id: "cattle-egret", name: "Cattle Egret", sci: "Bubulcus ibis", wiki: "Cattle_egret",
    regions: ["southeast", "plains", "southwest", "world"], rarity: 3, size: "crow", group: "water", carSpot: true,
    lookFor: "Walking beside cows and horses in pastures, or following tractors.",
    kidFact: "Cattle Egrets flew across the Atlantic Ocean from Africa on their own.",
    about: "A small, stocky white heron that eats insects stirred up by grazing animals. It reached South America from Africa in the late 1800s and spread north.",
    colors: ["#fbfbf8", "#f2f2ee", "#f3d9a4", "#ffffff", "#f2b02c"],
  },
  {
    id: "canada-goose", name: "Canada Goose", sci: "Branta canadensis", wiki: "Canada_goose",
    regions: NA, rarity: 1, size: "goose", group: "water", carSpot: true,
    lookFor: "Grazing on lawns, fields and ponds, or flying in noisy 'V' formations.",
    kidFact: "Geese take turns leading the V so no one gets too tired.",
    about: "Recognizable by its black neck and white chinstrap. Flying in a V lets each goose ride the air currents of the bird in front, saving energy on long migrations.",
    colors: ["#7b6a58", "#655647", "#141414", "#d8ccbc", "#141414"],
  },
  {
    id: "mallard", name: "Mallard", sci: "Anas platyrhynchos", wiki: "Mallard",
    regions: NA_ALL, rarity: 1, size: "pigeon", group: "water", carSpot: true,
    lookFor: "Ponds, canals and slow rivers. Males have a glossy green head and a yellow bill.",
    kidFact: "Almost every farm duck in the world descends from the Mallard.",
    about: "The world's most familiar duck. Only females make the classic loud 'quack'; males make a softer raspy call.",
    colors: ["#8c7b6a", "#6f6254", "#1e6a3a", "#b8a58f", "#e8c43a"],
  },
  {
    id: "sandhill-crane", name: "Sandhill Crane", sci: "Antigone canadensis", wiki: "Sandhill_crane",
    regions: ["plains", "mountain", "southeast", "boreal", "southwest"], rarity: 3, size: "eagle", group: "water", carSpot: true,
    lookFor: "Tall gray birds with a red cap in fields and wetlands, often in big groups. Listen for a rattling bugle overhead.",
    kidFact: "Sandhill Cranes dance, leaping, bowing and flapping, to impress each other.",
    about: "Cranes are one of the oldest bird families still alive today. Each spring, hundreds of thousands gather along Nebraska's Platte River, one of the great wildlife spectacles of the world.",
    colors: ["#9aa0a6", "#868c93", "#c2332e", "#a7adb3", "#2b2b2b"],
  },
  {
    id: "wild-turkey", name: "Wild Turkey", sci: "Meleagris gallopavo", wiki: "Wild_turkey",
    regions: ["southeast", "northeast", "plains", "mountain", "pacific"], rarity: 3, size: "goose", group: "ground", carSpot: true,
    lookFor: "Walking along field edges and woodland roadsides, often in groups early and late in the day.",
    kidFact: "Wild Turkeys can run 25 mph and fly in short bursts up to 55 mph.",
    about: "Once nearly wiped out, turkeys were brought back by reintroduction and now live in every lower-48 state. Males puff up and fan their tails in spring to show off.",
    colors: ["#4c3a2a", "#3e2f22", "#b3453b", "#3e2f22", "#c9b79c"],
  },
  {
    id: "scissor-tailed-flycatcher", name: "Scissor-tailed Flycatcher", sci: "Tyrannus forficatus", wiki: "Scissor-tailed_flycatcher",
    regions: ["plains"], rarity: 3, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Perched on wires along roads in Texas and Oklahoma, with an incredibly long forked tail.",
    kidFact: "Its tail is longer than its body and opens and closes like scissors in flight.",
    about: "The state bird of Oklahoma. Pale gray with salmon-pink flanks, it catches insects in mid-air with acrobatic swoops.",
    colors: ["#d5d8dc", "#3a3d42", "#dfe2e5", "#f2b8a0", "#222222"],
  },
  {
    id: "greater-roadrunner", name: "Greater Roadrunner", sci: "Geococcyx californianus", wiki: "Greater_roadrunner",
    regions: ["southwest", "plains", "pacific"], rarity: 5, size: "crow", group: "ground", carSpot: true,
    lookFor: "Dashing across desert roads and along brushy shoulders. Streaky brown with a shaggy crest and long tail.",
    kidFact: "Roadrunners really do run on roads, at speeds up to 20 mph. Meep meep!",
    about: "A ground cuckoo built for the desert. It eats lizards, scorpions and even rattlesnakes, and warms up on cold mornings by turning dark skin on its back to the sun.",
    colors: ["#7d6a52", "#5f4f3c", "#3d3328", "#d9cbb3", "#3a3a3a"],
  },
  {
    id: "loggerhead-shrike", name: "Loggerhead Shrike", sci: "Lanius ludovicianus", wiki: "Loggerhead_shrike",
    regions: ["southeast", "plains", "southwest", "mountain", "pacific"], rarity: 3, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Gray bird with a black mask sitting alone on wires and fence tops in open country.",
    kidFact: "Shrikes are nicknamed 'butcher birds' because they stick their prey on thorns and barbed wire.",
    about: "A songbird that hunts like a hawk. Shrikes lack strong talons, so they spear insects and lizards on sharp points to eat later. Their numbers have declined a lot.",
    colors: ["#9ca3aa", "#1e1e1e", "#9ca3aa", "#eef0f2", "#1a1a1a"],
  },
  {
    id: "barn-swallow", name: "Barn Swallow", sci: "Hirundo rustica", wiki: "Barn_swallow",
    regions: NA_ALL, rarity: 1, size: "sparrow", group: "songbird", carSpot: true,
    lookFor: "Swooping low over fields and water, and nesting under bridges and overpasses. Deeply forked tail.",
    kidFact: "Barn Swallows drink by skimming the water with their beaks while flying.",
    about: "The most widespread swallow in the world. They build mud cup nests under bridges, eaves and barn rafters, and they migrate as far as Argentina.",
    colors: ["#1f3a73", "#1a3263", "#b5532e", "#f0cfa8", "#1a1a1a"],
  },
  {
    id: "brown-pelican", name: "Brown Pelican", sci: "Pelecanus occidentalis", wiki: "Brown_pelican",
    regions: ["southeast", "pacific"], rarity: 3, size: "eagle", group: "water", carSpot: true,
    lookFor: "Coastal highways and piers. Lines of pelicans glide low over the waves, then plunge-dive for fish.",
    kidFact: "A pelican's pouch can hold three times more than its stomach!",
    about: "The only pelican that dives from the air for fish. Brown Pelicans were endangered by pesticides and have recovered along both coasts.",
    colors: ["#8a8175", "#6f675d", "#f4ecd6", "#8a8175", "#d8b36a"],
  },
  {
    id: "double-crested-cormorant", name: "Double-crested Cormorant", sci: "Nannopterum auritum", wiki: "Double-crested_cormorant",
    regions: NA, rarity: 1, size: "goose", group: "water", carSpot: true,
    lookFor: "Standing on rocks and pilings near water with wings spread out to dry.",
    kidFact: "Cormorant feathers soak up water so they can dive deeper, which is why they hang them out to dry.",
    about: "A dark, prehistoric-looking diving bird with an orange face and turquoise eyes. They swim low in the water like a submarine with only the head and neck showing.",
    colors: ["#1c1f22", "#2a2e2a", "#1c1f22", "#1c1f22", "#e8912f"],
  },
  {
    id: "northern-mockingbird", name: "Northern Mockingbird", sci: "Mimus polyglottos", wiki: "Northern_mockingbird",
    regions: ["southeast", "southwest", "pacific", "plains", "northeast"], rarity: 1, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Singing from the top of a shrub, sign or antenna. Gray with big white wing patches when it flies.",
    kidFact: "A single mockingbird can learn about 200 different songs!",
    about: "The great mimic. Mockingbirds copy other birds, frogs and even car alarms, and unmated males sometimes sing all night.",
    colors: ["#8e959c", "#5c6368", "#8e959c", "#e7e8e6", "#1a1a1a"],
  },
  {
    id: "gambels-quail", name: "Gambel's Quail", sci: "Callipepla gambelii", wiki: "Gambel's_quail",
    regions: ["southwest"], rarity: 3, size: "pigeon", group: "ground", carSpot: true,
    lookFor: "Groups scurrying across desert roads and into brush. Look for the forward-curling black topknot.",
    kidFact: "Quail families are called 'coveys', and chicks can run the same day they hatch.",
    about: "A plump desert quail with a comma-shaped plume, rufous cap and black face on males. They prefer running to flying and gather in large coveys in winter.",
    colors: ["#8c8f94", "#76797e", "#b8552f", "#e9dbbf", "#1a1a1a"],
  },
  {
    id: "annas-hummingbird", name: "Anna's Hummingbird", sci: "Calypte anna", wiki: "Anna's_hummingbird",
    regions: ["pacific", "southwest"], rarity: 5, size: "sparrow", group: "songbird", carSpot: false,
    lookFor: "Flowering shrubs at rest stops and gardens. Males flash a magenta head in the sun.",
    kidFact: "In a courtship dive, it moves faster for its size than a fighter jet.",
    about: "A year-round hummingbird of the West Coast. Its heart can beat over 1,200 times a minute, and on cold nights it drops into a hibernation-like state called torpor.",
    colors: ["#4d8a5a", "#3e7249", "#c2206e", "#b9c0b3", "#1a1a1a"],
  },
  {
    id: "ring-necked-pheasant", name: "Ring-necked Pheasant", sci: "Phasianus colchicus", wiki: "Common_pheasant",
    regions: ["plains", "mountain", "northeast", "pacific"], rarity: 3, size: "goose", group: "ground", carSpot: true,
    lookFor: "Field edges and ditches in farm country, especially in the Dakotas and Iowa.",
    kidFact: "Pheasants can burst into flight almost straight up like a rocket.",
    about: "Brought from Asia in the 1880s, males are dazzling with a green head, red face wattle, white collar and very long tail. South Dakota made it the state bird.",
    colors: ["#b76a33", "#8f5328", "#1f5d4a", "#c57a3d", "#e8d9b0"],
  },
  {
    id: "snowy-owl", name: "Snowy Owl", sci: "Bubo scandiacus", wiki: "Snowy_owl",
    regions: ["boreal", "northeast", "plains"], rarity: 5, size: "eagle", group: "raptor", carSpot: true,
    lookFor: "In winter, sitting on the ground, fence posts or barns in flat open country and airports.",
    kidFact: "Snowy Owls hunt in daylight because the Arctic summer never gets dark.",
    about: "An Arctic owl that moves south in some winters. Males can be nearly pure white; females and young have dark bars. A roadside Snowy is a trip highlight.",
    colors: ["#f7f7f4", "#e9e9e3", "#fafaf7", "#ffffff", "#2b2b2b"],
  },
  {
    id: "canada-jay", name: "Canada Jay", sci: "Perisoreus canadensis", wiki: "Canada_jay",
    regions: ["boreal", "mountain"], rarity: 3, size: "robin", group: "corvid", carSpot: false,
    lookFor: "Spruce forests and campgrounds in the North and high mountains. Fluffy and gray, and fearless around people.",
    kidFact: "Canada Jays will land right on your hand to take a snack.",
    about: "Also called the 'whiskey jack'. They store thousands of food bits in trees with sticky saliva and raise chicks in late winter, when snow still covers the ground.",
    colors: ["#8d949a", "#737a80", "#e6e6e3", "#c7cacc", "#1a1a1a"],
  },
  {
    id: "common-grackle", name: "Common Grackle", sci: "Quiscalus quiscula", wiki: "Common_grackle",
    regions: ["southeast", "northeast", "plains"], rarity: 1, size: "robin", group: "songbird", carSpot: true,
    lookFor: "Parking lots and lawns. Glossy black with a purple-bronze sheen and pale yellow eyes.",
    kidFact: "Grackles sometimes let ants crawl on them. Scientists think it helps clean their feathers.",
    about: "A big, confident blackbird that forms huge winter flocks. In sunlight its head shines purple-blue and its body bronze.",
    colors: ["#1b1a24", "#2a2438", "#2b2c5a", "#1b1a24", "#1a1a1a"],
  },
  {
    id: "great-tailed-grackle", name: "Great-tailed Grackle", sci: "Quiscalus mexicanus", wiki: "Great-tailed_grackle",
    regions: ["southwest", "plains", "pacific"], rarity: 1, size: "crow", group: "songbird", carSpot: true,
    lookFor: "Gas stations, fast-food lots and town squares in the Southwest. Males have a long, keel-shaped tail.",
    kidFact: "Great-tailed Grackles can make sounds like squeaky doors and laser blasters.",
    about: "This grackle has spread north from Mexico by following farms and towns. Its loud whistles and clacks are a soundtrack of Texas parking lots.",
    colors: ["#141222", "#241f3a", "#1f1d3f", "#141222", "#1a1a1a"],
  },
  {
    id: "house-sparrow", name: "House Sparrow", sci: "Passer domesticus", wiki: "House_sparrow",
    regions: NA_ALL, rarity: 1, size: "sparrow", group: "songbird", carSpot: false,
    lookFor: "Around diners, gas stations and farm buildings, chirping in noisy groups.",
    kidFact: "House Sparrows take dust baths to keep their feathers clean.",
    about: "Native to Europe and Asia, now found on every continent except Antarctica, almost always near people. Males have a gray cap, chestnut sides and a black bib.",
    colors: ["#94795b", "#7c5f43", "#8a8a88", "#cfc6b8", "#2a2a2a"],
  },
  {
    id: "belted-kingfisher", name: "Belted Kingfisher", sci: "Megaceryle alcyon", wiki: "Belted_kingfisher",
    regions: NA, rarity: 3, size: "pigeon", group: "water", carSpot: false,
    lookFor: "Wires and branches over creeks and rivers. Blue-gray with a big shaggy crest; listen for a loud rattle.",
    kidFact: "The female is more colorful than the male, which is unusual for birds.",
    about: "A big-headed fisher that hovers and dives headfirst. They dig nest tunnels up to six feet long into riverbanks.",
    colors: ["#5f86a8", "#4e7392", "#5f86a8", "#f4f4f2", "#1a1a1a"],
  },
  {
    id: "common-loon", name: "Common Loon", sci: "Gavia immer", wiki: "Common_loon",
    regions: ["boreal", "northeast"], rarity: 5, size: "goose", group: "water", carSpot: false,
    lookFor: "Big northern lakes. Checkered black-and-white back and a dagger bill; its call echoes across the water.",
    kidFact: "Loons can dive more than 200 feet deep!",
    about: "Loons have solid bones, unlike most birds, which helps them dive. Their haunting wail is the sound of northern summer lakes.",
    colors: ["#15191c", "#ececec", "#122a24", "#f4f4f4", "#1a1a1a"],
  },
];

export const SIZE_LABELS = {
  sparrow: { label: "Sparrow-sized", compare: "about as long as a dollar bill", inches: 6 },
  robin: { label: "Robin-sized", compare: "about as long as a TV remote", inches: 10 },
  pigeon: { label: "Pigeon-sized", compare: "about as long as a school ruler", inches: 13 },
  crow: { label: "Crow-sized", compare: "about as long as a bowling pin", inches: 18 },
  goose: { label: "Goose-sized", compare: "about as long as a skateboard", inches: 30 },
  eagle: { label: "Huge", compare: "wings wider than a grown-up is tall", inches: 40 },
};

export const RARITY = {
  1: { key: "common", label: "Common", points: 1 },
  3: { key: "uncommon", label: "Uncommon", points: 3 },
  5: { key: "rare", label: "Rare", points: 5 },
};

// Coarse ecological regions for North America; anything outside uses "world".
export function regionFor(lat, lng) {
  const inNA = lat > 14 && lat < 72 && lng < -52 && lng > -170;
  if (!inNA) return "world";
  if (lat >= 50 || lng < -140) return "boreal";
  if (lng < -117 || (lng < -114 && lat > 42)) return "pacific";
  if (lng < -103) return lat < 37 ? "southwest" : "mountain";
  if (lng < -94) return "plains";
  return lat < 36.5 ? "southeast" : "northeast";
}

export const REGION_NAMES = {
  pacific: "Pacific Coast",
  southwest: "Desert Southwest",
  mountain: "Mountain West",
  plains: "Great Plains",
  southeast: "Southeast",
  northeast: "Northeast & Great Lakes",
  boreal: "The North Woods",
  world: "Worldwide",
};

export function curatedForRegion(region) {
  return BIRDS.filter((b) => b.regions.includes(region));
}

const bySci = new Map(BIRDS.map((b) => [b.sci.toLowerCase(), b]));
const byName = new Map(BIRDS.map((b) => [b.name.toLowerCase(), b]));
export function findCurated(sci, name) {
  return bySci.get((sci || "").toLowerCase()) || byName.get((name || "").toLowerCase()) || null;
}

const RAPTOR = /hawk|eagle|falcon|kestrel|merlin|osprey|vulture|kite|harrier|owl|caracara|condor/i;
const WATER = /heron|egret|duck|goose|gull|tern|pelican|cormorant|grebe|loon|swan|teal|crane|sandpiper|plover|ibis|coot|stilt|avocet|yellowlegs|kingfisher|merganser|scaup|wigeon|shoveler|bufflehead|dowitcher|willet|curlew|killdeer|gallinule|rail|anhinga|stork|spoonbill|skimmer|pintail|gadwall|canvasback|redhead|goldeneye/i;
const CORVID = /crow|raven|jay|magpie|nutcracker/i;
const GROUND = /quail|turkey|pheasant|grouse|dove|pigeon|roadrunner|chachalaca|partridge|prairie-chicken/i;
export function guessGroup(name) {
  if (RAPTOR.test(name)) return "raptor";
  if (WATER.test(name)) return "water";
  if (CORVID.test(name)) return "corvid";
  if (GROUND.test(name)) return "ground";
  return "songbird";
}

export const GROUP_LABELS = {
  raptor: { label: "Birds of prey", emoji: "🦅" },
  water: { label: "Water birds", emoji: "🌊" },
  corvid: { label: "Crows & jays", emoji: "🧠" },
  ground: { label: "Ground birds", emoji: "🌾" },
  songbird: { label: "Songbirds", emoji: "🎵" },
};
