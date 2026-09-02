export interface SampleDataset {
  id: string;
  name: string;
  category: string;
  description: string;
  csvContent: string;
}

const todayStr = new Date().toISOString().split("T")[0];
const tomorrowDate = new Date(Date.now() + 86400000);
const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

// Compute dates for the current week (Sunday to Saturday)
const now = new Date();
const currentDay = now.getDay();
const sundayObj = new Date(now);
sundayObj.setDate(now.getDate() - currentDay);

const getDayDateStr = (offsetDays: number) => {
  const d = new Date(sundayObj);
  d.setDate(sundayObj.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

const sunDate = getDayDateStr(0);
const monDate = getDayDateStr(1);
const tueDate = getDayDateStr(2);
const wedDate = getDayDateStr(3);
const thuDate = getDayDateStr(4);
const friDate = getDayDateStr(5);
const satDate = getDayDateStr(6);

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "nds_camera_installs",
    name: "NDS Data Field Camera & Machine Installs (Weekly)",
    category: "Traffic, Cameras & Field Data",
    description: "Field Technicians with multi-location project grouping (-001, -002, -003), Schedule Order sorting (1, 2, 3...), Backup Units (+ 1 backup), Schedule Notes, Schedule Details (1 Day/24-hr), Setup Before, Teardown After (0:30 midnight rule & afternoon/night rules), and Battery Change/Equipment Checks.",
    csvContent: `Location ID,Schedule Order,Technician,TechEmail,Setup Before,Teardown After,Battery Change/Equipment Check 1,Battery Change/Equipment Check 2,Service Type,Service Type Add Ons (from Project ID) (from Locations),City, State,Different County (from Locations),Work Week,Camera Counts,Backup Units,Schedule Notes,Schedule Details,Teardown Time Notes,Days of collection,Method,Redo
26-240026-5666,1,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,ALG,Volume,Abbeville, LA,Vermilion Parish,Work Week 32,1 camera,,West leg pole,3-day collection,,3-day,Miovision,
26-240026-5667,2,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,ALG,Volume,Abbeville, LA,Vermilion Parish,Work Week 32,1 camera,,East corner pole,3-day collection,,3-day,Miovision,
26-530019-001,3,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,TMC,Pedestrians,Bicycles,Passenger Vehicles (FHWA 1-3),Buses (FHWA 4),Heavy Trucks (FHWA 5+),Lafayette, LA,Lafayette Parish,Work Week 32,3 cameras,,,1-day collection,,,Miovision,
26-530020-001,4,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,TMC,Pedestrians,Bicycles,Passenger Vehicles (FHWA 1-3),Buses (FHWA 4),Heavy Trucks (FHWA 5+),New Iberia, LA,Iberia Parish,Work Week 32,1 camera,1 backup,East corner pole,1-day collection,,,Cam - ATR Speed Algorithm,
26-530020-002,6,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,TMC,Pedestrians,Bicycles,Passenger Vehicles (FHWA 1-3),Buses (FHWA 4),Heavy Trucks (FHWA 5+),New Iberia, LA,Iberia Parish,Work Week 32,1 camera,1 backup,West leg light pole,1-day collection,,,Cam - ATR Algorithm,
26-530020-003,5,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,TMC,Pedestrians,Bicycles,Passenger Vehicles (FHWA 1-3),Buses (FHWA 4),Heavy Trucks (FHWA 5+),New Iberia, LA,Iberia Parish,Work Week 32,1 camera,1 backup,,1-day collection,,,Miovision,
26-230024-001,7,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 17:00,,,TMC,Volume,Houma, LA,Terrebonne Parish,Work Week 32,1 camera,1 backup,,1-day collection,,,Manual,
26-460059-001,8,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${friDate} 00:30,,,ALG,Volume,Leander, TX,Williamson County,Work Week 32,1 camera,1 backup,East corner pole,1 Day: Tue/Wed/Thu = TBD,,1-day,Miovision,
26-470285-001,9,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 00:30,,,PED,Pedestrians,Dallas, TX,Dallas County,Work Week 32,1 camera,1 backup,(City of Dallas - List 105),1-day collection,,,Miovision,
26-470285-002,10,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 00:30,,,PED,Pedestrians,Dallas, TX,Dallas County,Work Week 32,2 cameras,2 backups,(City of Dallas - List 105),1-day collection,,,Miovision,
26-470265-001,10,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${wedDate} 0:30,,,Near Miss Study,Vehicle to Vehicle,Dallas, TX,Dallas County,Work Week 32,0 cameras,,,Also collecting data for 26-470265-003,1-day collection,,,ATR,true
26-470265-002,11,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${wedDate} 0:30,,,Near Miss Study,Vehicle to Vehicle,Dallas, TX,Dallas County,Work Week 32,0 cameras,,,Data being collected by 26-470263-002,1-day collection,,,Miovision,
26-450228-001,11,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${thuDate} 19:00,,,TMC,Pedestrians,Bicycles,Passenger Vehicles (FHWA 1-3),Heavy Trucks (FHWA 4+),Huffman, TX,Harris County,Work Week 32,1 camera,1 backup,North corner pole,,,,Miovision,
26-450227-001,12,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 10:30,${thuDate} 19:30,,,TMC,Heavy Trucks (FHWA 4+),Houston, TX,Harris County,Work Week 32,1 camera,1 backup,Median post,,,,ATR,
26-450218-001,13,Gavin Adams,gavin.adams@ndsdata.com,${monDate} 08:00,${wedDate} 18:30,,,TMC,Heavy Trucks (FHWA 4+),Houston, TX,Harris County,Work Week 32,4 cameras,,West leg light pole,1 Day: Tue/Wed = TBD,,,Miovision,
26-104822-001,1,Gavin Adams,gavin.adams@ndsdata.com,${tueDate} 08:00,${wedDate} 14:00,,,Miovision,,Dallas, TX,Dallas County,Work Week 32,2 cameras,1 backup,,,,,Miovision,
26-104845-001,,Gavin Adams,gavin.adams@ndsdata.com,,${tueDate} 14:00,,,Miovision,,Fort Worth, TX,Tarrant County,Work Week 32,0 cameras,,,Anytime,,Miovision,
26-104899-001,,Gavin Adams,gavin.adams@ndsdata.com,,,${wedDate} 10:00,,Miovision,,Plano, TX,Collin County,Work Week 32,4 cameras,,,,3-day,Miovision,
26-104910-001,,Gavin Adams,gavin.adams@ndsdata.com,,${thuDate} 10:00,,,Miovision,,Irving, TX,Dallas County,Work Week 32,2 cameras,,,,,Miovision,
26-450222-001,1,Gavin Adams,gavin.adams@ndsdata.com,${friDate} 08:00,${satDate} 14:00,,,Miovision,ATR Volume,Houston, TX,Harris County,Work Week 32,2 cameras,,,,,,ATR,
26-104950-001,2,Gavin Adams,gavin.adams@ndsdata.com,${friDate} 07:00,,,,Miovision,ATR,Arlington, TX,Tarrant County,Work Week 32,2 cameras,,,,,,ATR,
26-470274-001,14,Gavin Adams,gavin.adams@ndsdata.com,${wedDate} 08:30,,,,Radar,Radar (Spot Speed),Little Elm, TX,Denton County,Work Week 32,1 camera,,Conduct Spot Speed,3 hours,,,Radar,
26-470290-001,15,Gavin Adams,gavin.adams@ndsdata.com,${thuDate} 09:00,,,,Parking,Parking Study,Frisco, TX,Collin County,Work Week 32,1 camera,,Conduct Parking Inventory,4 hours,,,Manual,
26-204100-001,1,Shaw, Tyler,tyler.shaw@ndsdata.com,${monDate} 08:00,${thuDate} 16:00,${tueDate} 09:00,,Miovision,,Houston, TX,Harris County,Work Week 32,3 cameras,,,,3-day,Miovision,
26-204110-001,,Shaw, Tyler,tyler.shaw@ndsdata.com,,${wedDate} 11:30,,,Miovision,,Pasadena, TX,Harris County,Work Week 32,1 camera,,,Anytime,,Miovision,
26-304200-001,1,Carlos Coreas,carlos.coreas@ndsdata.com,${tueDate} 08:00,${friDate} 15:00,${wedDate} 10:00,,Miovision,,Austin, TX,Travis County,Work Week 32,2 cameras,,,,5-day,Miovision,
26-304210-001,,Carlos Coreas,carlos.coreas@ndsdata.com,,${thuDate} 09:00,,,Miovision,,Round Rock, TX,Williamson County,Work Week 32,2 cameras,,,Anytime,,Miovision,
26-404300-001,1,Diego Coreas,diego.coreas@ndsdata.com,${monDate} 08:00,${friDate} 16:30,,,Miovision,,San Antonio, TX,Bexar County,Work Week 32,4 cameras,,,,,Miovision,
26-404305-001,2,Justin Windecker,justin.windecker@ndsdata.com,${wedDate} 08:30,,,,Miovision,Radar,New Braunfels, TX,Comal County,Work Week 32,2 cameras,,,,,Miovision,`
  },
  {
    id: "nds_overlapping_weeks",
    name: "NDS Work Week 35 & 36 (Overlapping Battery Swaps & Teardowns)",
    category: "Traffic, Cameras & Field Data",
    description: "Includes Work Week 35 installs with battery swaps and teardowns that overlap into Monday/Wednesday of Work Week 36. Toggle 'Overlapping Schedule' ON to combine carryover tasks!",
    csvContent: `Location ID,Schedule Order,Technician,TechEmail,Setup Before,Teardown After,Battery Change/Equipment Check 1,Battery Change/Equipment Check 2,Service Type,Service Type Add Ons (from Project ID) (from Locations),City, State,Different County (from Locations),Work Week,Camera Counts,Backup Units,Schedule Notes,Schedule Details,Teardown Time Notes,Days of collection,Method,Redo
26-350100-001,1,Gavin Adams,gavin.adams@ndsdata.com,2026-08-27 08:00,2026-09-02 17:00,2026-08-31 09:00,,Miovision,Volume,Abbeville, LA,Vermilion Parish,Work Week 35,2 cameras,1 backup,East corner pole,5-day collection,,5-day,Miovision,
26-350102-001,2,Gavin Adams,gavin.adams@ndsdata.com,2026-08-28 08:00,2026-09-01 16:00,2026-08-31 11:00,,Miovision,Volume,Lafayette, LA,Lafayette Parish,Work Week 35,1 camera,,West leg pole,3-day collection,,3-day,Miovision,
26-360201-001,1,Gavin Adams,gavin.adams@ndsdata.com,2026-08-31 08:00,2026-09-03 17:00,,,TMC,Pedestrians,Bicycles,New Iberia, LA,Iberia Parish,Work Week 36,1 camera,1 backup,Median post,3-day collection,,,Miovision,
26-360202-001,2,Gavin Adams,gavin.adams@ndsdata.com,2026-09-01 08:00,2026-09-04 17:00,,,ALG,Volume,Houma, LA,Terrebonne Parish,Work Week 36,2 cameras,,South corner pole,3-day collection,,,ATR,
26-360203-001,3,Gavin Adams,gavin.adams@ndsdata.com,2026-09-02 08:00,2026-09-05 14:00,,,TMC,Heavy Trucks,Leander, TX,Williamson County,Work Week 36,1 camera,1 backup,,1-day collection,,,Miovision,`
  },
  {
    id: "hvac_service",
    name: "HVAC & Commercial Refrigeration Dispatch",
    category: "Heating & Cooling",
    description: "4 Technicians, 12 urgent & routine maintenance tickets with parts checklists.",
    csvContent: `WorkOrder,Technician,TechEmail,Date,TimeSlot,Customer,Phone,Address,JobType,Priority,Description,SpecialInstructions,PartsRequired,EstMin
WO-8821,Marcus Vance,marcus.vance@precisiontech.com,${tomorrowStr},08:00 AM - 10:00 AM,Apex Medical Center,555-0192,"8400 Health Park Blvd, Suite 210, Austin TX",Chiller Diagnostic,Urgent,"Main ICU backup chiller displaying error code E-44 high pressure trip.","Report directly to Facilities Mgr Dave at Dock B. Badge required.","Refrigerant R-410A, Manifold Gauges, Pressure Transducer",120
WO-8822,Marcus Vance,marcus.vance@precisiontech.com,${tomorrowStr},10:45 AM - 12:30 PM,Summit Office Suites,555-0143,"3200 Westlake Hills Dr, Bldg 4, Austin TX",Quarterly Filter & Belt PM,Normal,"Replace 4x MERV 13 filters and inspect blower motor belt tension on RTU-2.","Rooftop access key located at security front desk.",4x MERV-13 24x24x2 Filters, V-Belt B-48,75
WO-8823,Marcus Vance,marcus.vance@precisiontech.com,${tomorrowStr},01:30 PM - 03:30 PM,Lone Star Brewery,555-0188,"1204 E 6th St, Austin TX",Walk-in Freezer Service,High,"Cold storage temp creeping above 28°F. Evaporator coil frosting over.","Wear thermal coat. Enter through delivery alley rear door.","Defrost Timer, Coil Defrost Heater Element",90
WO-8824,Elena Rostova,elena.rostova@precisiontech.com,${tomorrowStr},08:30 AM - 10:30 AM,Skyline Tower Condos,555-0219,"1100 Congress Ave, Penthouse 18B, Austin TX",VRF System No Cool,High,"Master bedroom ceiling cassette unit leaking condensate and not cooling.","Call concierge 15 min prior to arrival. Freight elevator reserved.","Condensate pump 240V, Float switch, 3/8 drain line",90
WO-8825,Elena Rostova,elena.rostova@precisiontech.com,${tomorrowStr},11:15 AM - 01:15 PM,Canyon Vista Residence,555-0311,"7402 Lost Creek Canyon, Austin TX",Heat Pump Seasonal Tune-up,Normal,"Customer enrolled in Gold Service Plan. Check capacitor and subcooling.","Gate code #4491. Beware of friendly golden retriever in yard.","Dual Run Capacitor 45/5 MFD, Contactor 30A",60
WO-8826,Elena Rostova,elena.rostova@precisiontech.com,${tomorrowStr},02:00 PM - 04:30 PM,Barton Springs Retail,555-0455,"2100 S Lamar Blvd, Austin TX",Commercial Rooftop Unit Overhaul,Urgent,"Compressor #1 humming but not turning over. Store reporting 82°F inside.","Ladder required to access roof hatch on south wall.","Hard Start Kit, 3-Pole 40A Contactor, Core Removal Tool",150
WO-8827,David Chen,david.chen@precisiontech.com,${tomorrowStr},08:00 AM - 10:30 AM,Riverside Tech Campus,555-0567,"4500 E Riverside Dr, Data Center 3, Austin TX",CRAC Precision Cooling Audit,Urgent,"Computer Room Air Handler #4 fan vibration alarm triggered. Critical rack cooling.","Escort required inside server room at all times. Static wrist strap mandatory.","Direct Drive EC Fan Motor, Replacement Belts",120
WO-8828,David Chen,david.chen@precisiontech.com,${tomorrowStr},11:00 AM - 01:00 PM,Capital Food Mart,555-0678,"901 N IH-35, Austin TX",Reach-in Deli Display Case,High,"Open deli case temperatures reading 46°F instead of 38°F. Compressor cycling rapidly.","Check in with store manager Sal upon arrival.","TXV Valve, Low-temp Filter Drier, R-404A canister",90
WO-8829,David Chen,david.chen@precisiontech.com,${tomorrowStr},02:00 PM - 03:45 PM,Oakview Elementary School,555-0789,"3400 Oakview Way, Austin TX",Gymnasium RTU Sensor Replacement,Normal,"Zone thermostat lost calibration after lightning storm yesterday.","Check in at main admin office with government ID.","Honeywell T6 Pro Thermostat, 10k Ohm Temp Sensor",75
WO-8830,Jordan Bell,jordan.bell@precisiontech.com,${tomorrowStr},08:30 AM - 11:00 AM,Greenbelt Orthodontics,555-0812,"6800 Bee Cave Rd, Suite 100, Austin TX",Dental Air Compressor & Vacuum PM,Normal,"Annual oil change and air filter replacement for surgical vacuum pumps.","Arrive before first patient appointment at 9:00 AM if possible.","Oil filter 0.01 micron, Synthetic vacuum lube 1-Gal",120
WO-8831,Jordan Bell,jordan.bell@precisiontech.com,${tomorrowStr},11:45 AM - 01:45 PM,Mueller Town Center,555-0923,"1900 Aldrich St, Unit 120, Austin TX",Ductwork Leak & Balancing,Normal,"Tenant complaining of cold airflow in conference room and weak flow in lobby.","Inspect flex duct dampers in ceiling drop tiles. Step ladder provided on site.","Balancing Hood, Foil Tape, 10-inch Flexible Duct Sleeve",90
WO-8832,Jordan Bell,jordan.bell@precisiontech.com,${tomorrowStr},02:30 PM - 04:30 PM,South Congress Boutique,555-0994,"1502 S Congress Ave, Austin TX",Split System Thermostat & Wiring,High,"Thermostat blank screen. 24V transformer fuse blown on indoor air handler board.","Parking in rear private lot behind wooden fence.","24V 40VA Transformer, 3A Blade Fuses, 18/5 Thermostat Wire",90`
  },
  {
    id: "telecom_fiber",
    name: "Fiber Telecom & Enterprise Network Installs",
    category: "Telecommunications",
    description: "3 Fiber Specialists, 9 enterprise GPON & optical splicing dispatch assignments.",
    csvContent: `WorkOrder,Technician,TechEmail,Date,TimeSlot,Customer,Phone,Address,JobType,Priority,Description,SpecialInstructions,PartsRequired,EstMin
NET-301,Carlos Mendez,carlos.mendez@novafiber.net,${tomorrowStr},08:00 AM - 11:00 AM,NexGen BioTech Labs,555-2101,"500 Innovation Way, Suite 400, Seattle WA",10G Dedicated Fiber Turnup,Urgent,"Light level test on Strand 12/14. Splice optical patch at Telco Demarc cabinet.","Clean room shoe covers required in lab hallway.","Corning 12-strand OptiSheath, LC-UPC Pigtails, OTDR Tester",180
NET-302,Carlos Mendez,carlos.mendez@novafiber.net,${tomorrowStr},11:45 AM - 02:00 PM,Harbor View Financial,555-2102,"1200 4th Ave, Floor 22, Seattle WA",BGP Router Migration,High,"Cutover primary WAN uplink from Legacy Copper to 1Gbps Metro-E circuit.","Coordinate with client IT Director Tim at extension 402.","Cisco SFP-10G-LR Module, Cat6A Shielded Patch 15ft",120
NET-303,Carlos Mendez,carlos.mendez@novafiber.net,${tomorrowStr},02:30 PM - 04:30 PM,Fremont Studios,555-2103,"3500 Phinney Ave N, Seattle WA",Optical Fiber Splicing Repair,High,"Cable trench damaged during utility digging. Fusion splice 4 broken buffer tubes.","Traffic cones & high-vis vest required on sidewalk.","Fujikura Fusion Splicer, Splice Sleeves 60mm, Fiber Enclosure Dome",120
NET-304,Sarah Jenkins,sarah.jenkins@novafiber.net,${tomorrowStr},08:30 AM - 11:30 AM,Pioneer Square Lofts,555-2201,"110 S Washington St, Seattle WA",MDU GPON Splitter Installation,High,"Install 1:32 optical splitter in basement MDF for new 48-unit residential building.","Keys with building super Pete in Apt 101.","1x32 PLC Optical Splitter, Wall Mount ODF Box, SC-APC Jumpers",150
NET-305,Sarah Jenkins,sarah.jenkins@novafiber.net,${tomorrowStr},12:30 PM - 02:30 PM,Ballard Marine Supply,555-2202,"5200 Ballard Ave NW, Seattle WA",ONT Modem Upgrade,Normal,"Replace old Calix 716GE with WiFi 6 Gigaspire unit. Verify 1000Mbps down speed.","Customer needs receipt for signature.","Calix GS4227E ONT, Power Supply 12V 3A, Fiber Patch SC/APC",90
NET-306,Sarah Jenkins,sarah.jenkins@novafiber.net,${tomorrowStr},03:00 PM - 05:00 PM,Queen Anne Coffee Co,555-2203,"2200 Queen Anne Ave N, Seattle WA",POS Wi-Fi VLAN Separation,Normal,"Customer POS terminals dropping during peak hours. Configure guest & POS SSIDs.","Free espresso provided by shop owner!","Ubiquiti U6-Pro Access Point, PoE Injector 802.3at",90
NET-307,Liam O'Connor,liam.oconnor@novafiber.net,${tomorrowStr},08:00 AM - 10:30 AM,Soundview Hospital Clinic,555-2301,"1500 15th Ave E, Seattle WA",SIP Trunk Gateway Provision,Urgent,"Hospital lost secondary voice trunk. Reconfigure Adtran NetVanta PRI gateway.","Critical emergency lines. Test outbound 911 caller ID.","Adtran Total Access 908e, T1 Loopback Plug",120
NET-308,Liam O'Connor,liam.oconnor@novafiber.net,${tomorrowStr},11:00 AM - 01:30 PM,South Lake Union Coworking,555-2302,"800 Mercer St, Floor 3, Seattle WA",Fiber Drop Aerial Pull,Normal,"Pull 250ft armored aerial fiber from pole 42 to rooftop weatherhead.","Safety harness and bucket truck pre-trip inspection required.","250ft Flat Drop Fiber, Aerial J-Hooks, Span Clamps",120
NET-309,Liam O'Connor,liam.oconnor@novafiber.net,${tomorrowStr},02:15 PM - 04:30 PM,Capitol Hill Bakery,555-2303,"500 E Pike St, Seattle WA",Fiber Jack Relocation,Normal,"Move ONT jack 15ft away from new bakery convection oven to prevent heat damage.","Run conduit along baseboard.","Microduct 8mm, Pushable Fiber SC-APC 30ft",100`
  },
  {
    id: "solar_electrical",
    name: "Solar PV & Commercial Electrical Fleet",
    category: "Renewable Energy & Electrical",
    description: "3 Electricians, 8 inverters, battery storage and EV charging station tickets.",
    csvContent: `WorkOrder,Technician,TechEmail,Date,TimeSlot,Customer,Phone,Address,JobType,Priority,Description,SpecialInstructions,PartsRequired,EstMin
SOL-101,Tariq Al-Mansoor,tariq.almansoor@sunvoltpower.com,${tomorrowStr},08:00 AM - 11:00 AM,Valley Ridge Microgrid,555-3011,"4000 Sunridge Dr, Phoenix AZ",SolarEdge Inverter Fault 18x72,Urgent,"Primary 3-phase commercial inverter threw isolation fault after dust storm.","Lockout/Tagout main DC disconnect prior to opening housing.","SolarEdge SE33.3K Inverter Board, DC Fuses 1000V 15A, Multimeter",150
SOL-102,Tariq Al-Mansoor,tariq.almansoor@sunvoltpower.com,${tomorrowStr},12:00 PM - 03:00 PM,Biltmore Country Club,555-3012,"2400 E Missouri Ave, Phoenix AZ",Tesla Powerwall 3 Commissioning,High,"Final commissioning and gateway firmware update for 4x Powerwall backup system.","Customer wants mobile app demonstration before signoff.","Tesla Backup Gateway 2, Neurio CT Meter, 100A Breaker",150
SOL-103,Rachel Gomez,rachel.gomez@sunvoltpower.com,${tomorrowStr},08:00 AM - 10:30 AM,Scottsdale Auto Mall,555-3021,"7200 E McDowell Rd, Scottsdale AZ",DC Fast Charger Repair (Level 3),Urgent,"ChargePoint 150kW dual connector CCS cable cooling pump failed.","Cordon off charging bays 3 and 4 with safety tape.","Liquid Cooling Pump Module, CCS1 Cable Assembly",120
SOL-104,Rachel Gomez,rachel.gomez@sunvoltpower.com,${tomorrowStr},11:15 AM - 01:45 PM,Desert Ridge Plaza,555-3022,"21001 N Tatum Blvd, Phoenix AZ",Parking Lot LED Transformer PM,Normal,"Inspect 480V to 120/208V step-down transformer and photo-cell timers.","Bucket truck needed for photocell sensor on pole #8.","Square D 45kVA Transformer Lugs, Intermatic Photo Eye 277V",120
SOL-105,Rachel Gomez,rachel.gomez@sunvoltpower.com,${tomorrowStr},02:30 PM - 04:30 PM,Paradise Valley Estate,555-3023,"5800 E Lincoln Dr, Paradise Valley AZ",Enphase Microinverter Replacement,High,"String #2 showing 3 unresponsive IQ8+ microinverters on tile roof.","Roof steep pitch 8/12. Safety anchor harness mandatory.","3x Enphase IQ8+ Microinverters, Disconnect Tool, Q-Cable Jumper",100
SOL-106,Nathan Drake,nathan.drake@sunvoltpower.com,${tomorrowStr},08:30 AM - 11:30 AM,Chandler Industrial Park,555-3031,"6200 W Chandler Blvd, Chandler AZ",Main Service Panel Upgrade 400A,Urgent,"Upgrade main electrical panel for manufacturing facility CNC expansion.","Power company utility shutoff scheduled at 08:30 sharp.","Eaton 400A Main Breaker Panel, 4/0 Copper Wire, Ground Rods",180
SOL-107,Nathan Drake,nathan.drake@sunvoltpower.com,${tomorrowStr},12:30 PM - 02:45 PM,Gilbert Logistics Warehouse,555-3032,"1400 S Cooper Rd, Gilbert AZ",Forklift Battery Charging Station,Normal,"Install 3x 50A 480V Hubbell industrial receptacles for new electric forklifts.","Run 1-inch EMT conduit along steel I-beams.","50A 3-Pole 480V Breakers, Hubbell 50A Receptacles, 1in EMT",120
SOL-108,Nathan Drake,nathan.drake@sunvoltpower.com,${tomorrowStr},03:15 PM - 05:00 PM,Tempe Tech Incubator,555-3033,"800 S Mill Ave, Tempe AZ",Sub-panel Arc Fault Inspection,Normal,"Tenant reporting nuisance tripping on circuit #14 conference room displays.","Test circuit load with clamp meter.","Siemens 20A Dual Function AFCI/GFCI Breaker",90`
  }
];
