/* Historical encounter scalars supplied with the project. */
(function (global) {
  "use strict";

  const source = "https://orbital-mechanics.space/interplanetary-maneuvers/planetary-arrival-flyby.html";

  global.FLYBY_EVENTS = [
    { id: "cassini-venus-1", mission: "Cassini", date: "1998-04-26", planet: "venus", altitude: 284, vinf: 7.2, source },
    { id: "cassini-venus-2", mission: "Cassini", date: "1999-06-24", planet: "venus", altitude: 598, vinf: 6.9, source },
    { id: "messenger-venus-1", mission: "MESSENGER", date: "2006-10-24", planet: "venus", altitude: 2992, vinf: 7.5, source },
    { id: "messenger-venus-2", mission: "MESSENGER", date: "2007-06-05", planet: "venus", altitude: 338, vinf: 6.9, source },
    { id: "voyager-1-jupiter", mission: "Voyager 1", date: "1979-03-05", planet: "jupiter", altitude: 277400, vinf: 10.8, source },
    { id: "voyager-2-jupiter", mission: "Voyager 2", date: "1979-07-09", planet: "jupiter", altitude: 720000, vinf: 13.6, source },
    { id: "cassini-jupiter", mission: "Cassini", date: "2000-12-30", planet: "jupiter", altitude: 10000000, vinf: 12.5, source },
    { id: "new-horizons-jupiter", mission: "New Horizons", date: "2007-02-28", planet: "jupiter", altitude: 2304537, vinf: 18.0, source },
  ];
})(window);
