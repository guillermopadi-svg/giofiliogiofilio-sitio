/* UI prototype only: no calendar credentials, requests or stored appointments. */
(function () {
  'use strict';
  var examples = [
    [['10:00', 'Llamada de primer contacto', '30 min · Llamada', 'call'], ['12:30', 'Visita a propiedad en Santa Fe', '60 min · Visita', 'visit']],
    [['11:00', 'Seguimiento de propuesta', '30 min · Llamada', 'call']],
    [],
    [['16:00', 'Recorrido de propiedad', '60 min · Visita', 'visit']],
    []
  ];
  document.querySelectorAll('.agenda-widget').forEach(function (widget) {
    var list = widget.querySelector('.agenda-events');
    function render(day) {
      list.replaceChildren();
      widget.querySelectorAll('[data-agenda-day]').forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.agendaDay) === day)); });
      if (!examples[day].length) {
        var empty = document.createElement('p'); empty.className = 'agenda-empty'; empty.textContent = 'Sin citas en este día de ejemplo.'; list.appendChild(empty); return;
      }
      examples[day].forEach(function (event) {
        var row = document.createElement('div'); row.className = 'agenda-event agenda-event--' + event[3];
        var time = document.createElement('span'); time.className = 'agenda-hour'; time.textContent = event[0];
        var body = document.createElement('div'); var title = document.createElement('strong'); title.textContent = event[1];
        var detail = document.createElement('small'); detail.textContent = event[2]; body.append(title, detail); row.append(time, body); list.appendChild(row);
      });
    }
    widget.querySelectorAll('[data-agenda-day]').forEach(function (button) { button.addEventListener('click', function () { render(Number(button.dataset.agendaDay)); }); });
    render(0);
  });
}());
